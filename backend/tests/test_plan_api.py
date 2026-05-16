"""Smoke tests for POST /api/plan (Anthropic streaming call mocked).

After the refactor: the planner returns a markdown Claude Code prompt as plain text,
not a structured PlanResponse{classifications, plan_steps}. We mock the Anthropic
streaming API to return a synthetic markdown string.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient


def _fake_doc():
    from app.extractor.schema import Annotation, DocumentAnnotations, PageAnnotations

    def _ann(idx, page, intent):
        return Annotation(
            id=f"a{idx}",
            page=page,
            shape="handwriting",
            type="replace",
            bbox=[0, 0, 100, 30],
            anchor_bbox=[0, 0, 100, 30],
            anchor_text="foo",
            context_text=f"surrounding for a{idx}",
            annotation_content="bar",
            intent=intent,
            has_arrow=False,
            confidence=0.9,
        )

    return DocumentAnnotations(
        source_filename="paper.pdf",
        total_pages=2,
        pages=[
            PageAnnotations(
                page_number=1,
                width_px=1000,
                height_px=1000,
                annotations=[_ann(1, 1, "replace foo with bar"), _ann(2, 1, "delete foo")],
            ),
            PageAnnotations(
                page_number=2,
                width_px=1000,
                height_px=1000,
                annotations=[_ann(3, 2, "replace foo with bar")],
            ),
        ],
    )


_FAKE_PROMPT = """# Address reviewer annotations on paper.pdf

You are addressing reviewer feedback on a paper in this repo.

## Edits

### 1. Replace 'foo' with 'bar' throughout
- Source pages: p.1, p.2
- Refers to: `foo` → `bar`
"""


def _mock_anthropic_message():
    """Stand-in for the final message returned by stream.get_final_message()."""
    block = SimpleNamespace(type="text", text=_FAKE_PROMPT)
    return SimpleNamespace(
        content=[block],
        stop_reason="end_turn",
        usage=SimpleNamespace(input_tokens=1234, output_tokens=567),
    )


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    from app.main import app
    return TestClient(app)


def test_plan_route_returns_markdown(client, monkeypatch):
    class StubStream:
        def __init__(self, response):
            self._response = response

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def __aiter__(self):
            return self

        async def __anext__(self):
            raise StopAsyncIteration

        async def get_final_message(self):
            return self._response

    class StubMessages:
        def stream(self, **kwargs):
            return StubStream(_mock_anthropic_message())

    class StubAsyncAnthropic:
        def __init__(self, *a, **kw):
            self.messages = StubMessages()

    monkeypatch.setattr("app.services.planner.AsyncAnthropic", StubAsyncAnthropic)

    doc = _fake_doc().model_dump()
    resp = client.post("/api/plan", json={"document": doc})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    plan = body["plan"]
    assert "Address reviewer annotations" in plan["prompt"]
    assert plan["summary"].startswith("Address reviewer annotations")
    assert plan["annotation_count"] == 3


def test_plan_route_rejects_empty_doc(client):
    empty = {
        "document": {
            "source_filename": "x.pdf",
            "total_pages": 0,
            "pages": [],
        }
    }
    resp = client.post("/api/plan", json=empty)
    assert resp.status_code == 400
