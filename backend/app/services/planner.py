"""Single Claude call: per-annotation classification + an ordered plan.

DECISIONS.md §D3: we fold what the spec called "intent classification" and the
"planner" into one tool-use call. The tool input schema is generated from
`PlanResponse.model_json_schema()`.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from anthropic import AsyncAnthropic

from app.config import settings
from app.extractor.schema import DocumentAnnotations
from app.schemas.plan import PlanResponse

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "planner.md"
PLANNER_SYSTEM = PROMPT_PATH.read_text()


def _tool_input_schema() -> dict:
    """JSON Schema for the propose_plan tool, derived from PlanResponse."""
    schema = PlanResponse.model_json_schema()
    # Strip the Pydantic-specific "title" field that Anthropic ignores anyway,
    # and ensure additionalProperties:false everywhere (some providers require it
    # for "strict" tool calls; Anthropic is lenient, but this is safer).
    return schema


def _build_user_message(doc: DocumentAnnotations) -> str:
    flat = doc.flat_annotations
    payload = [
        {
            "id": a.id,
            "page": a.page,
            "shape": a.shape.value if hasattr(a.shape, "value") else a.shape,
            "type": a.type.value if hasattr(a.type, "value") else a.type,
            "anchor_text": a.anchor_text,
            "annotation_content": a.annotation_content,
            "context_text": a.context_text,
            "intent": a.intent,
            "has_arrow": a.has_arrow,
            "confidence": a.confidence,
        }
        for a in flat
    ]
    return (
        f"Source paper: **{doc.source_filename}** ({doc.total_pages} pages, "
        f"{len(flat)} annotations).\n\n"
        "Each annotation already has a coarse `type` (delete/insert/replace/comment/...) "
        "from the visual extraction pass. Your job is to assign a finer-grained "
        "`reviewer_intent` to each, AND to produce an ordered plan of edits.\n\n"
        f"<annotations>\n{json.dumps(payload, indent=2)}\n</annotations>\n\n"
        "Produce the plan via the `propose_plan` tool. Every annotation must appear in "
        "exactly one `classifications` entry by `annotation_id`."
    )


async def generate_plan(
    doc: DocumentAnnotations,
    *,
    api_key: str | None = None,
    model: str | None = None,
) -> PlanResponse:
    """One Claude call → PlanResponse (classifications + plan)."""
    key = api_key or settings.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set on the backend")

    client = AsyncAnthropic(api_key=key)
    user_msg = _build_user_message(doc)

    resp = await client.messages.create(
        model=model or settings.claude_model,
        max_tokens=8192,
        system=PLANNER_SYSTEM,
        tools=[
            {
                "name": "propose_plan",
                "description": (
                    "Propose an ordered plan AND per-annotation reviewer_intent "
                    "classifications in one call."
                ),
                "input_schema": _tool_input_schema(),
            }
        ],
        tool_choice={"type": "tool", "name": "propose_plan"},
        messages=[{"role": "user", "content": user_msg}],
    )

    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "propose_plan":
            return PlanResponse.model_validate(block.input)

    raise RuntimeError(
        f"planner did not use propose_plan; stop_reason={resp.stop_reason!r}, "
        f"content={resp.content!r}"
    )
