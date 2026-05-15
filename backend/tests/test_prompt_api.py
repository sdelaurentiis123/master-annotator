"""Smoke tests for POST /api/prompt (pure Jinja render — no network)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


def _doc_and_plan():
    """Three annotations across two pages; one plan groups two of them."""
    from app.extractor.schema import Annotation, DocumentAnnotations, PageAnnotations

    def _ann(idx, page, intent, rint="update"):
        a = Annotation(
            id=f"a{idx}",
            page=page,
            shape="handwriting",
            type="replace",
            bbox=[0, 0, 100, 30],
            anchor_bbox=[0, 0, 100, 30],
            anchor_text="foo",
            context_text=f"... foo on page {page} ...",
            annotation_content="bar",
            intent=intent,
            has_arrow=False,
            confidence=0.9,
        )
        # Set reviewer_intent post-construction since the enum is optional
        from app.extractor.schema import ReviewerIntent
        a.reviewer_intent = ReviewerIntent(rint)
        return a

    doc = DocumentAnnotations(
        source_filename="paper.pdf",
        total_pages=2,
        pages=[
            PageAnnotations(
                page_number=1,
                width_px=1000,
                height_px=1000,
                annotations=[_ann(1, 1, "replace foo with bar"), _ann(2, 1, "delete foo", rint="delete")],
            ),
            PageAnnotations(
                page_number=2,
                width_px=1000,
                height_px=1000,
                annotations=[_ann(3, 2, "replace foo with bar")],
            ),
        ],
    )

    plan_dict = {
        "summary": "One global replacement + one comment.",
        "steps": [
            {
                "id": "step-1",
                "order": 1,
                "kind": "commit",
                "title": "Replace 'foo' with 'bar' throughout",
                "description": "Apply foo→bar globally.",
                "source_annotation_ids": ["a1", "a3"],
                "target_files_hint": ["sections/intro.tex"],
                "requires_human_confirmation": False,
                "rationale": "Reviewer marked on two pages.",
            },
            {
                "id": "step-2",
                "order": 2,
                "kind": "pr_comment",
                "title": "Reviewer suggested deleting foo on p.1",
                "description": "Surfaces deletion for review.",
                "source_annotation_ids": ["a2"],
                "target_files_hint": [],
                "requires_human_confirmation": False,
                "rationale": "Ambiguous strike.",
            },
        ],
        "unactionable_count": 1,
    }

    return doc.model_dump(), plan_dict


def test_prompt_renders_all_steps_and_annotations(client):
    doc, plan = _doc_and_plan()
    resp = client.post("/api/prompt", json={"document": doc, "plan": plan})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    md = body["prompt"]

    # Plan summary and stats
    assert "One global replacement" in md
    assert "1 commit step" in md
    assert "1 PR comment step" in md

    # Every step title appears
    assert "Replace 'foo' with 'bar' throughout" in md
    assert "Reviewer suggested deleting foo on p.1" in md

    # Source annotations resolved with page + instruction
    assert "p.1" in md and "p.2" in md
    assert "replace foo with bar" in md
    assert "delete foo" in md

    # Target file hint preserved
    assert "sections/intro.tex" in md


def test_prompt_lists_unplanned_when_any(client):
    """An annotation not in any step's source_annotation_ids must surface in 'NOT in the plan'."""
    doc, plan = _doc_and_plan()
    # Drop a2 from the second step so it becomes unplanned
    plan["steps"][1]["source_annotation_ids"] = []
    resp = client.post("/api/prompt", json={"document": doc, "plan": plan})
    assert resp.status_code == 200
    md = resp.json()["prompt"]
    assert "Annotations NOT in the plan" in md
    # a2's intent "delete foo" should appear under unplanned
    unplanned_block = md.split("Annotations NOT in the plan", 1)[1]
    assert "delete foo" in unplanned_block


def test_prompt_rejects_empty_plan(client):
    doc, plan = _doc_and_plan()
    plan["steps"] = []
    resp = client.post("/api/prompt", json={"document": doc, "plan": plan})
    assert resp.status_code == 400
