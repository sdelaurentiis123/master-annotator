"""Batched, rate-limited multi-page extraction.

`extract_with_batching` calls the synchronous extractor primitives from
`app.extractor.extract` inside `asyncio.to_thread`, gated by a Semaphore so
we never have more than `concurrency` Gemini requests in flight.

Per-page retries on 429/5xx live in `extract_page` itself.
"""
from __future__ import annotations

import asyncio
import os

from google import genai

from app.extractor import (
    DocumentAnnotations,
    PageAnnotations,
    extract_page,
    rasterize_pdf,
)


async def extract_with_batching(
    pdf_bytes: bytes,
    *,
    source_filename: str,
    model: str,
    dpi: int = 300,
    concurrency: int = 6,
    api_key: str | None = None,
) -> DocumentAnnotations:
    """Concurrent multi-page extraction. Sequential rasterize, parallel Gemini calls."""
    if not pdf_bytes:
        raise ValueError("empty pdf_bytes")

    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set on the backend")

    client = genai.Client(api_key=key)

    # Rasterize is fast and CPU-bound; push it to a thread so we don't block
    # the event loop, but don't bother parallelizing across pages.
    rasterized = await asyncio.to_thread(rasterize_pdf, pdf_bytes, dpi=dpi)

    sem = asyncio.Semaphore(concurrency)

    async def run_one(page_num: int, png_bytes: bytes, w: int, h: int) -> PageAnnotations:
        async with sem:
            anns = await asyncio.to_thread(
                extract_page,
                client,
                model=model,
                page_num=page_num,
                png_bytes=png_bytes,
                width=w,
                height=h,
                dpi=dpi,
            )
            return PageAnnotations(
                page_number=page_num,
                width_px=w,
                height_px=h,
                annotations=anns,
            )

    pages = await asyncio.gather(*(run_one(*p) for p in rasterized))
    pages.sort(key=lambda p: p.page_number)
    return DocumentAnnotations(
        source_filename=source_filename,
        total_pages=len(rasterized),
        pages=pages,
    )
