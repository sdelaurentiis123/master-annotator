"""POST /api/prompt — Plan + DocumentAnnotations in, rendered markdown out."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.extractor.schema import DocumentAnnotations
from app.schemas.plan import Plan
from app.services.prompt_builder import render_prompt

router = APIRouter()


class PromptRequest(BaseModel):
    document: DocumentAnnotations
    plan: Plan


@router.post("/api/prompt")
def prompt_route(req: PromptRequest) -> dict:
    if not req.plan.steps:
        raise HTTPException(status_code=400, detail="plan has no steps")
    try:
        return {"prompt": render_prompt(req.document, req.plan)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"render failed: {e}")
