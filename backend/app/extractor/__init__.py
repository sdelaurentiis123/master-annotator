"""Annotation extractor — Gemini vision over rasterized PDF pages."""
from .extract import extract_annotations, extract_page, rasterize_pdf
from .schema import (
    Annotation,
    AnnotationShape,
    AnnotationType,
    DocumentAnnotations,
    PageAnnotations,
    RawAnnotation,
    ReviewerIntent,
)

__all__ = [
    "extract_annotations",
    "extract_page",
    "rasterize_pdf",
    "Annotation",
    "AnnotationShape",
    "AnnotationType",
    "DocumentAnnotations",
    "PageAnnotations",
    "RawAnnotation",
    "ReviewerIntent",
]
