"""Sync extraction primitives.

The FastAPI server wraps these in `asyncio.to_thread` for concurrent multi-page
runs. Keeping the primitives sync means the CLI and pytest can use them directly
with no event loop.
"""
from __future__ import annotations

import json
import os
import time
from typing import Callable, TypeVar

import fitz  # pymupdf
from google import genai
from google.genai import types

from .prompts import PROMPT_TEMPLATE
from .schema import (
    Annotation,
    DocumentAnnotations,
    PageAnnotations,
    RawAnnotation,
)

T = TypeVar("T")


def rasterize_pdf(pdf_bytes: bytes, *, dpi: int = 300) -> list[tuple[int, bytes, int, int]]:
    """Rasterize every page to PNG bytes at the given DPI.

    Returns (page_num_1idx, png_bytes, width_px, height_px) per page.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pages: list[tuple[int, bytes, int, int]] = []
    try:
        for i in range(len(doc)):
            pix = doc.load_page(i).get_pixmap(matrix=mat, alpha=False)
            pages.append((i + 1, pix.tobytes("png"), pix.width, pix.height))
    finally:
        doc.close()
    return pages


def extract_page(
    client: genai.Client,
    *,
    model: str,
    page_num: int,
    png_bytes: bytes,
    width: int,
    height: int,
    dpi: int = 300,
) -> list[Annotation]:
    """Single Gemini call for one rasterized page. Sync. Retries 429/5xx inline."""
    prompt = PROMPT_TEMPLATE.format(dpi=dpi, width=width, height=height)
    cfg = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=list[RawAnnotation],
        temperature=0.0,
        max_output_tokens=65536,
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.HIGH),
    )

    def _call():
        return client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(data=png_bytes, mime_type="image/png"),
                prompt,
            ],
            config=cfg,
        )

    resp = _with_backoff(_call)
    raws = _parse_response(resp)
    return [
        Annotation(**raw.model_dump(), page=page_num)
        for raw in raws
    ]


def _parse_response(resp) -> list[RawAnnotation]:
    parsed = getattr(resp, "parsed", None)
    if parsed:
        return list(parsed)

    raw = (resp.text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:].lstrip()
    if not raw:
        return []
    data = json.loads(raw)
    return [RawAnnotation.model_validate(a) for a in data]


def _with_backoff(
    fn: Callable[[], T],
    *,
    attempts: int = 5,
    base: float = 5.0,
    cap: float = 60.0,
) -> T:
    """Exponential backoff on rate-limit / 5xx errors from google-genai."""
    delay = base
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
            msg = str(exc).lower()
            retryable = (
                status in {429, 500, 502, 503, 504}
                or "rate" in msg
                or "quota" in msg
                or "resource_exhausted" in msg
                or "unavailable" in msg
            )
            if not retryable or attempt == attempts:
                raise
            last_exc = exc
            time.sleep(min(delay, cap))
            delay *= 2
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("unreachable")


def extract_annotations(
    pdf_bytes: bytes,
    *,
    source_filename: str = "input.pdf",
    model: str = "gemini-3.1-pro-preview",
    dpi: int = 300,
    api_key: str | None = None,
) -> DocumentAnnotations:
    """Sync, sequential extraction across all pages.

    Used by the CLI and tests. The FastAPI server uses `services.extraction`
    which wraps `extract_page` calls in `asyncio.to_thread` for concurrency.
    """
    client = genai.Client(api_key=api_key or os.environ.get("GEMINI_API_KEY"))
    rasterized = rasterize_pdf(pdf_bytes, dpi=dpi)
    pages: list[PageAnnotations] = []
    for page_num, png_bytes, width, height in rasterized:
        anns = extract_page(
            client,
            model=model,
            page_num=page_num,
            png_bytes=png_bytes,
            width=width,
            height=height,
            dpi=dpi,
        )
        pages.append(
            PageAnnotations(
                page_number=page_num,
                width_px=width,
                height_px=height,
                annotations=anns,
            )
        )
    return DocumentAnnotations(
        source_filename=source_filename,
        total_pages=len(rasterized),
        pages=pages,
    )
