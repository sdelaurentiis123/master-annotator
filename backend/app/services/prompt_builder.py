"""Render the Claude Code prompt the user pastes into their local agent.

Pure Jinja2 template. No LLM call.
"""
from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, StrictUndefined

from app.extractor.schema import Annotation, DocumentAnnotations
from app.schemas.plan import Plan, PlanStepKind

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "prompts" / "claude_code.md"
_env = Environment(
    keep_trailing_newline=True,
    trim_blocks=True,
    lstrip_blocks=True,
    undefined=StrictUndefined,
)


def render_prompt(doc: DocumentAnnotations, plan: Plan) -> str:
    by_id: dict[str, Annotation] = {a.id: a for a in doc.flat_annotations}
    referenced_ids: set[str] = set()

    steps_resolved = []
    for step in plan.steps:
        resolved = []
        for aid in step.source_annotation_ids:
            referenced_ids.add(aid)
            a = by_id.get(aid)
            if a is None:
                continue
            resolved.append(_annotation_view(a))
        steps_resolved.append(
            {
                "order": step.order,
                "title": step.title,
                "kind": step.kind.value if hasattr(step.kind, "value") else step.kind,
                "description": step.description,
                "rationale": step.rationale,
                "target_files_hint": step.target_files_hint or [],
                "requires_human_confirmation": step.requires_human_confirmation,
                "source_annotations": resolved,
            }
        )

    unplanned = [
        _annotation_view(a) for a in doc.flat_annotations if a.id not in referenced_ids
    ]

    commit_count = sum(1 for s in plan.steps if s.kind == PlanStepKind.commit)
    pr_count = sum(1 for s in plan.steps if s.kind == PlanStepKind.pr_comment)
    manual_count = sum(1 for s in plan.steps if s.kind == PlanStepKind.manual)

    template = _env.from_string(TEMPLATE_PATH.read_text())
    return template.render(
        plan={"summary": plan.summary, "steps": steps_resolved},
        unplanned_annotations=unplanned,
        commit_count=commit_count,
        pr_count=pr_count,
        manual_count=manual_count,
    )


def _annotation_view(a: Annotation) -> dict:
    return {
        "page": a.page,
        "reviewer_intent": a.reviewer_intent.value if a.reviewer_intent else None,
        "confidence": a.confidence,
        "intent": a.intent,
        "anchor_text": a.anchor_text,
        "annotation_content": a.annotation_content,
        "context_text": a.context_text,
        "user_edited": a.user_edited,
    }
