"""Smoke tests for POST /api/plan with the Anthropic call mocked."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient


def _fake_doc():
    from app.extractor.schema import (
        Annotation,
        DocumentAnnotations,
        PageAnnotations,
    )

    def _ann(idx: int, page: int, intent: str, conf: float = 0.9) -> Annotation:
        return Annotation(
            id=f"a{idx}",
            page=page,
            shape="handwriting",
            type="replace",
            bbox=[10, 10, 100, 30],
            anchor_bbox=[10, 10, 100, 30],
            anchor_text="foo",
            context_text=f"surrounding text for a{idx}",
            annotation_content="bar",
            intent=intent,
            has_arrow=False,
            confidence=conf,
        )

    return DocumentAnnotations(
        source_filename="zoltan.pdf",
        total_pages=2,
        pages=[
            PageAnnotations(
                page_number=1,
                width_px=1000,
                height_px=1000,
                annotations=[
                    _ann(1, 1, "replace 'foo' with 'bar'"),
                    _ann(2, 1, "delete the phrase 'foo'", conf=0.5),
                ],
            ),
            PageAnnotations(
                page_number=2,
                width_px=1000,
                height_px=1000,
                annotations=[_ann(3, 2, "replace 'foo' with 'bar'")],
            ),
        ],
    )


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    from app.main import app
    return TestClient(app)


def _mock_anthropic_response():
    """Hand-rolled stand-in for an Anthropic Messages response with a tool_use block."""
    plan_input = {
        "classifications": [
            {"annotation_id": "a1", "reviewer_intent": "update", "reasoning": "strike+replacement"},
            {"annotation_id": "a2", "reviewer_intent": "delete", "reasoning": "strike no replacement, low confidence"},
            {"annotation_id": "a3", "reviewer_intent": "update", "reasoning": "same edit as a1, page 2"},
        ],
        "plan": {
            "summary": "1 commit, 1 pr_comment.",
            "steps": [
                {
                    "id": "step-1",
                    "order": 1,
                    "kind": "commit",
                    "title": "Replace 'foo' with 'bar' throughout",
                    "description": "Apply foo→bar globally to text content.",
                    "source_annotation_ids": ["a1", "a3"],
                    "target_files_hint": ["sections/intro.tex"],
                    "requires_human_confirmation": False,
                    "rationale": "Reviewer marked the same edit on both pages.",
                },
                {
                    "id": "step-2",
                    "order": 2,
                    "kind": "pr_comment",
                    "title": "Reviewer suggested deleting 'foo' on p.1 (low confidence)",
                    "description": "Low-confidence strike; surface for human review.",
                    "source_annotation_ids": ["a2"],
                    "target_files_hint": [],
                    "requires_human_confirmation": True,
                    "rationale": "Confidence below the auto-apply threshold.",
                },
            ],
            "unactionable_count": 1,
        },
    }
    block = SimpleNamespace(type="tool_use", name="propose_plan", input=plan_input)
    return SimpleNamespace(content=[block], stop_reason="tool_use")


def test_plan_route_runs(client, monkeypatch):
    async def fake_create(**kwargs):
        return _mock_anthropic_response()

    # Patch the async client constructor to return a stub with a `messages.create`.
    class StubMessages:
        async def create(self, **kwargs):
            return _mock_anthropic_response()

    class StubAsyncAnthropic:
        def __init__(self, *a, **kw):
            self.messages = StubMessages()

    monkeypatch.setattr("app.services.planner.AsyncAnthropic", StubAsyncAnthropic)

    doc = _fake_doc().model_dump()
    resp = client.post("/api/plan", json={"document": doc})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    # classifications: every annotation labelled
    assert len(body["classifications"]) == 3
    ids = sorted(c["annotation_id"] for c in body["classifications"])
    assert ids == ["a1", "a2", "a3"]

    # plan: grouped same-edit annotations, one pr_comment
    assert body["plan"]["unactionable_count"] == 1
    kinds = [s["kind"] for s in body["plan"]["steps"]]
    assert "commit" in kinds and "pr_comment" in kinds


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


def test_planner_schema_generation():
    """The Pydantic-derived input schema must be JSON-serializable and well-formed."""
    import json
    from app.services.planner import _tool_input_schema
    schema = _tool_input_schema()
    json.dumps(schema)  # not raising = ok
    assert schema["type"] == "object"
    assert "classifications" in schema["properties"]
    assert "plan" in schema["properties"]
