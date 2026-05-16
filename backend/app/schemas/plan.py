"""Plan = a Claude Code markdown prompt + a few stats.

Way simpler than the earlier structured Plan/PlanStep tree. The reader is
another Claude Code session, not a UI tree.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class Plan(BaseModel):
    """Stored on `papers.plan` JSONB and surfaced verbatim in the copy dialog."""
    prompt: str = Field(description="Markdown Claude Code prompt the user pastes")
    summary: str = Field(default="", description="One-line summary for the UI header")
    annotation_count: int = Field(default=0, description="Annotations covered")


class PlanResponse(BaseModel):
    """Response shape for POST /api/plan."""
    plan: Plan
