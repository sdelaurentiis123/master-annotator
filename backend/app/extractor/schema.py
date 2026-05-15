"""Pydantic models for the extractor pipeline.

RawAnnotation is exactly what Gemini returns (via response_schema).
Annotation extends it with post-hoc fields (id, page, reviewer_intent, user_edited).
This split keeps Gemini's structured-output schema clean while letting the rest of
the app pass the richer Annotation everywhere.
"""
from __future__ import annotations

from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, Field


class AnnotationShape(StrEnum):
    strikethrough = "strikethrough"
    scribble = "scribble"
    caret = "caret"
    circle = "circle"
    underline = "underline"
    highlight = "highlight"
    bracket = "bracket"
    arrow = "arrow"
    handwriting = "handwriting"
    dot = "dot"


class AnnotationType(StrEnum):
    delete = "delete"
    insert = "insert"
    replace = "replace"
    comment = "comment"
    question = "question"
    emphasize = "emphasize"
    flag = "flag"


class ReviewerIntent(StrEnum):
    """Set by the planner pass (Claude), not by extraction."""
    insert = "insert"
    delete = "delete"
    update = "update"
    methodological_error = "methodological_error"
    question = "question"
    confusion = "confusion"
    critique = "critique"


class RawAnnotation(BaseModel):
    """Direct Gemini output. Used as response_schema for the per-page call."""
    shape: AnnotationShape
    type: AnnotationType
    bbox: list[int] = Field(description="[x0,y0,x1,y1] of the mark itself, normalized 0-1000")
    anchor_bbox: list[int] = Field(default_factory=list)
    anchor_text: str = ""
    context_text: str = ""
    annotation_content: str = ""
    intent: str
    has_arrow: bool = False
    confidence: float = Field(ge=0.0, le=1.0)


class Annotation(RawAnnotation):
    """RawAnnotation plus post-extraction fields."""
    id: str = Field(default_factory=lambda: uuid4().hex)
    page: int = 0
    reviewer_intent: ReviewerIntent | None = None
    user_edited: bool = False


class PageAnnotations(BaseModel):
    page_number: int
    width_px: int
    height_px: int
    annotations: list[Annotation]


class DocumentAnnotations(BaseModel):
    source_filename: str
    total_pages: int
    pages: list[PageAnnotations]

    @property
    def flat_annotations(self) -> list[Annotation]:
        """All annotations across all pages, in page order."""
        return [a for page in self.pages for a in page.annotations]
