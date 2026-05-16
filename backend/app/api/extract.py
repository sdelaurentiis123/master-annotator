"""POST /api/extract — multipart PDF in, DocumentAnnotations JSON out.

If the request includes a `paper_id` form field, per-page progress is also
published to that paper's bus so the frontend can render a live progress bar
while it awaits the final response.
"""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app import bus
from app.config import settings
from app.services.extraction import extract_with_batching

router = APIRouter()


@router.post("/api/extract")
async def extract_route(
    file: UploadFile = File(...),
    paper_id: str | None = Form(default=None),
) -> dict:
    if not file.content_type or "pdf" not in file.content_type:
        raise HTTPException(
            status_code=400,
            detail=f"expected application/pdf, got {file.content_type or 'unknown'}",
        )
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="empty file")
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file too large (max 50 MB)")

    b = bus.get_or_create(paper_id) if paper_id else None
    try:
        doc = await extract_with_batching(
            pdf_bytes,
            source_filename=file.filename or "unnamed.pdf",
            model=settings.gemini_model,
            dpi=settings.extract_dpi,
            concurrency=settings.extract_concurrency,
            bus_=b,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"extraction failed: {e}")
    finally:
        # Close the bus so any subscribers cleanly drain. Idempotent.
        if b is not None:
            b.close()

    return doc.model_dump()
