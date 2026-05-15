"""Smoke tests for POST /api/extract. The real Gemini call is mocked out."""
from __future__ import annotations

import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    from app.main import app
    return TestClient(app)


def _fake_extract_page(client, *, model, page_num, png_bytes, width, height, dpi):
    """Stand-in for the Gemini call. Returns a single fake annotation per page."""
    from app.extractor.schema import Annotation
    return [
        Annotation(
            page=page_num,
            shape="handwriting",
            type="comment",
            bbox=[100, 100, 200, 200],
            anchor_bbox=[],
            anchor_text="",
            context_text="",
            annotation_content=f"fake annotation for page {page_num}",
            intent=f"page-{page_num} test annotation",
            has_arrow=False,
            confidence=0.9,
        )
    ]


def test_rejects_non_pdf(client):
    resp = client.post(
        "/api/extract",
        files={"file": ("foo.txt", b"not a pdf", "text/plain")},
    )
    assert resp.status_code == 400
    assert "pdf" in resp.json()["detail"].lower()


def test_rejects_empty(client):
    resp = client.post(
        "/api/extract",
        files={"file": ("foo.pdf", b"", "application/pdf")},
    )
    # Empty body — either 400 "empty file" or FastAPI's own validation
    assert resp.status_code in (400, 422)


def test_extracts_with_mocked_gemini(client, monkeypatch):
    """End-to-end through the route, but the Gemini call is mocked."""
    pdf_path = Path(__file__).resolve().parents[2] / "zoltan-marginalia.pdf"
    if not pdf_path.exists():
        pytest.skip(f"test fixture missing: {pdf_path}")

    # Patch where it's *used*, not where it's defined.
    monkeypatch.setattr(
        "app.services.extraction.extract_page", _fake_extract_page
    )

    with pdf_path.open("rb") as f:
        resp = client.post(
            "/api/extract",
            files={"file": ("zoltan.pdf", f.read(), "application/pdf")},
        )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["source_filename"] == "zoltan.pdf"
    assert body["total_pages"] >= 1
    # Pages should be in order
    page_nums = [p["page_number"] for p in body["pages"]]
    assert page_nums == sorted(page_nums)
    # Each page should have exactly the one fake annotation
    for p in body["pages"]:
        assert len(p["annotations"]) == 1
        ann = p["annotations"][0]
        assert ann["page"] == p["page_number"]
        assert ann["intent"] == f"page-{p['page_number']} test annotation"
        assert "id" in ann
        assert ann["reviewer_intent"] is None


def test_batching_respects_concurrency(monkeypatch):
    """The concurrency limit + ordering invariant of extract_with_batching."""
    import asyncio
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    from app.services import extraction

    # In-flight counter to assert the semaphore works
    in_flight = 0
    max_seen = 0

    def slow_fake(client, *, model, page_num, png_bytes, width, height, dpi):
        from app.extractor.schema import Annotation
        nonlocal in_flight, max_seen
        in_flight += 1
        max_seen = max(max_seen, in_flight)
        import time
        time.sleep(0.05)
        in_flight -= 1
        return [
            Annotation(
                page=page_num,
                shape="dot",
                type="flag",
                bbox=[0, 0, 1, 1],
                intent=f"p{page_num}",
                confidence=1.0,
            )
        ]

    # Fake rasterize: 12 pages of tiny PNGs
    def fake_rasterize(_bytes, *, dpi):
        return [(i + 1, b"\x89PNG", 100, 100) for i in range(12)]

    monkeypatch.setattr(extraction, "extract_page", slow_fake)
    monkeypatch.setattr(extraction, "rasterize_pdf", fake_rasterize)

    doc = asyncio.run(
        extraction.extract_with_batching(
            b"fake",
            source_filename="x.pdf",
            model="gemini-3.1-pro-preview",
            concurrency=3,
        )
    )

    assert doc.total_pages == 12
    assert len(doc.pages) == 12
    assert [p.page_number for p in doc.pages] == list(range(1, 13))
    assert max_seen <= 3, f"semaphore violated: saw {max_seen} concurrent calls"
