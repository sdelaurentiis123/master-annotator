"""POST /api/plan — DocumentAnnotations in, PlanResponse out."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.extractor.schema import DocumentAnnotations
from app.services.planner import generate_plan

router = APIRouter()


class PlanRequest(BaseModel):
    document: DocumentAnnotations


@router.post("/api/plan")
async def plan_route(req: PlanRequest) -> dict:
    if not req.document.flat_annotations:
        raise HTTPException(status_code=400, detail="document has no annotations to plan")

    try:
        plan = await generate_plan(req.document)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"planner failed: {e}")

    return plan.model_dump()
