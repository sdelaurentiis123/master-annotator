"""POST /api/extract — multipart PDF in, DocumentAnnotations JSON out."""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import settings
from app.services.extraction import extract_with_batching

router = APIRouter()


@router.post("/api/extract")
async def extract_route(file: UploadFile = File(...)) -> dict:
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

    try:
        doc = await extract_with_batching(
            pdf_bytes,
            source_filename=file.filename or "unnamed.pdf",
            model=settings.gemini_model,
            dpi=settings.extract_dpi,
            concurrency=settings.extract_concurrency,
        )
    except RuntimeError as e:
        # e.g. missing API key
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        # Surface upstream failures with status so the frontend can show a useful toast.
        raise HTTPException(status_code=502, detail=f"extraction failed: {e}")

    return doc.model_dump()
