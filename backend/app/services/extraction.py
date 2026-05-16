"""Batched, rate-limited multi-page extraction with per-page progress logs."""
from __future__ import annotations

import asyncio
import os
import sys
import time

from google import genai

from app.config import settings
from app.extractor import (
    DocumentAnnotations,
    PageAnnotations,
    extract_page,
    rasterize_pdf,
)


def _log(msg: str) -> None:
    """Print to stdout so uvicorn surfaces it. flush=True is the point."""
    print(f"[extract] {msg}", flush=True, file=sys.stderr)


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

    key = api_key or settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set on the backend")

    client = genai.Client(api_key=key)

    t0 = time.monotonic()
    _log(f"{source_filename} ({len(pdf_bytes)} bytes) — rasterizing at {dpi} dpi…")
    rasterized = await asyncio.to_thread(rasterize_pdf, pdf_bytes, dpi=dpi)
    raster_elapsed = time.monotonic() - t0
    _log(f"rasterized {len(rasterized)} pages in {raster_elapsed:.1f}s "
         f"(concurrency={concurrency}, model={model})")

    sem = asyncio.Semaphore(concurrency)
    started_at: dict[int, float] = {}
    done: set[int] = set()

    async def run_one(page_num: int, png_bytes: bytes, w: int, h: int) -> PageAnnotations:
        """Per-page worker. Catches its own errors so one bad page doesn't kill the run."""
        async with sem:
            started_at[page_num] = time.monotonic()
            in_flight = len(started_at) - len(done)
            _log(f"p{page_num:>2} START ({w}x{h}, {in_flight} in flight)")

            anns = []
            error: str | None = None
            for attempt in (1, 2):
                try:
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
                    error = None
                    break
                except Exception as e:
                    error = f"{type(e).__name__}: {e}"
                    if attempt == 1:
                        _log(f"p{page_num:>2} attempt 1 failed: {error} — retrying")

            elapsed = time.monotonic() - started_at[page_num]
            done.add(page_num)
            if error:
                _log(f"p{page_num:>2} FAILED after {elapsed:.1f}s — keeping run alive: {error}")
            else:
                _log(f"p{page_num:>2} done in {elapsed:.1f}s ({len(anns)} annotations)")
            return PageAnnotations(
                page_number=page_num,
                width_px=w,
                height_px=h,
                annotations=anns,
            )

    pages = await asyncio.gather(*(run_one(*p) for p in rasterized))
    pages.sort(key=lambda p: p.page_number)
    total = sum(len(p.annotations) for p in pages)
    failed = sum(1 for p in pages if len(p.annotations) == 0)
    _log(f"DONE {source_filename} — {len(pages)} pages, {total} annotations, "
         f"{failed} empty/failed, {time.monotonic() - t0:.1f}s total")
    return DocumentAnnotations(
        source_filename=source_filename,
        total_pages=len(rasterized),
        pages=pages,
    )
