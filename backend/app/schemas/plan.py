"""Planner output schema: per-annotation classifications + an ordered plan.

This is the response_schema for the SINGLE Claude call that does both intent
classification and plan generation (see DECISIONS.md §D3).
"""
from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

from app.extractor.schema import ReviewerIntent


class PlanStepKind(StrEnum):
    commit = "commit"          # actionable: agent applies the edit
    pr_comment = "pr_comment"  # informational: ends up in the PR description
    manual = "manual"          # surfaced as an item the author must handle


class PlanStep(BaseModel):
    id: str = Field(description="Unique id for this step (any string)")
    order: int = Field(description="1-indexed dependency order across the plan")
    kind: PlanStepKind
    title: str = Field(description="One-line imperative summary")
    description: str = Field(
        description="Detailed instruction for the agent, self-contained enough to act on"
    )
    source_annotation_ids: list[str] = Field(
        default_factory=list,
        description="ids of the annotations that motivated this step",
    )
    target_files_hint: list[str] = Field(
        default_factory=list,
        description="Best-guess LaTeX/figure files the agent should expect to touch",
    )
    requires_human_confirmation: bool = False
    rationale: str = Field(description="One sentence on why this step exists")


class Plan(BaseModel):
    summary: str = Field(description="One paragraph overview of the whole plan")
    steps: list[PlanStep]
    unactionable_count: int = Field(
        description="Count of steps with kind=manual or kind=pr_comment"
    )


class Classification(BaseModel):
    annotation_id: str
    reviewer_intent: ReviewerIntent
    reasoning: str = Field(description="One short sentence justifying the label")


class PlanResponse(BaseModel):
    """Combined classifier + planner output. ONE Claude call returns this."""
    classifications: list[Classification]
    plan: Plan
