"""POST /api/plan — DocumentAnnotations in, markdown Claude Code prompt out."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.extractor.schema import DocumentAnnotations
from app.schemas.plan import Plan, PlanResponse
from app.services.planner import generate_plan_prompt

router = APIRouter()


class PlanRequest(BaseModel):
    document: DocumentAnnotations


@router.post("/api/plan")
async def plan_route(req: PlanRequest) -> dict:
    flat = req.document.flat_annotations
    if not flat:
        raise HTTPException(status_code=400, detail="document has no annotations to plan")

    try:
        prompt = await generate_plan_prompt(req.document)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"planner failed: {e}")

    # First H1 line, stripped, makes a decent summary
    first_h1 = next(
        (line.lstrip("# ").strip() for line in prompt.splitlines() if line.startswith("# ")),
        "Plan",
    )

    return PlanResponse(
        plan=Plan(
            prompt=prompt,
            summary=first_h1[:200],
            annotation_count=len(flat),
        )
    ).model_dump()
