"""Slice-1 smoke tests. No network, no API keys required."""
from __future__ import annotations

from pathlib import Path

import pytest


def test_extractor_imports():
    from app.extractor import (
        Annotation,
        AnnotationShape,
        AnnotationType,
        DocumentAnnotations,
        PageAnnotations,
        RawAnnotation,
        ReviewerIntent,
        extract_annotations,
        extract_page,
        rasterize_pdf,
    )
    # Make sure the names exist
    assert callable(extract_annotations)
    assert callable(extract_page)
    assert callable(rasterize_pdf)
    assert AnnotationType.delete == "delete"
    assert ReviewerIntent.methodological_error == "methodological_error"
    assert AnnotationShape.handwriting == "handwriting"


def test_raw_annotation_schema_roundtrip():
    from app.extractor import RawAnnotation, Annotation

    raw = RawAnnotation(
        shape="handwriting",
        type="replace",
        bbox=[100, 200, 300, 400],
        anchor_bbox=[110, 210, 290, 390],
        anchor_text="foo",
        context_text="surrounding text foo here",
        annotation_content="bar",
        intent="replace 'foo' with 'bar'",
        has_arrow=False,
        confidence=0.9,
    )
    assert raw.shape == "handwriting"
    enriched = Annotation(**raw.model_dump(), page=3)
    assert enriched.page == 3
    assert enriched.reviewer_intent is None
    assert enriched.user_edited is False
    assert len(enriched.id) == 32  # uuid4 hex


def test_document_annotations_flat():
    from app.extractor import Annotation, DocumentAnnotations, PageAnnotations

    def _ann(page: int, intent: str) -> Annotation:
        return Annotation(
            page=page,
            shape="handwriting",
            type="replace",
            bbox=[0, 0, 10, 10],
            intent=intent,
            confidence=1.0,
        )

    doc = DocumentAnnotations(
        source_filename="x.pdf",
        total_pages=2,
        pages=[
            PageAnnotations(page_number=1, width_px=100, height_px=100, annotations=[_ann(1, "a"), _ann(1, "b")]),
            PageAnnotations(page_number=2, width_px=100, height_px=100, annotations=[_ann(2, "c")]),
        ],
    )
    flat = doc.flat_annotations
    assert [a.intent for a in flat] == ["a", "b", "c"]


def test_rasterize_pdf_returns_pngs():
    """Smoke: PyMuPDF rasterizes the test fixture without API calls."""
    pdf_path = Path(__file__).resolve().parents[2] / "zoltan-marginalia.pdf"
    if not pdf_path.exists():
        pytest.skip(f"test fixture missing: {pdf_path}")
    from app.extractor import rasterize_pdf

    pages = rasterize_pdf(pdf_path.read_bytes(), dpi=72)  # low DPI for speed
    assert len(pages) >= 1
    page_num, png_bytes, w, h = pages[0]
    assert page_num == 1
    assert png_bytes.startswith(b"\x89PNG")
    assert w > 0 and h > 0


def test_health_endpoint():
    """FastAPI app boots and the health route returns 200."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert "gemini_key" in body and "anthropic_key" in body
