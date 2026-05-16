"""Single Claude call → a Claude Code markdown prompt.

Replaces the earlier structured-tool-use approach. Lighter, faster, and what
the user actually wants: paste-into-Claude-Code text, not a JSON plan tree.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from anthropic import AsyncAnthropic

from app.config import settings
from app.extractor.schema import DocumentAnnotations

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "planner.md"
PLANNER_SYSTEM = PROMPT_PATH.read_text()


def _log(msg: str) -> None:
    print(f"[plan] {msg}", flush=True, file=sys.stderr)


def _build_user_message(doc: DocumentAnnotations) -> str:
    flat = doc.flat_annotations
    payload = [
        {
            "page": a.page,
            "type": a.type.value if hasattr(a.type, "value") else a.type,
            "anchor_text": a.anchor_text,
            "annotation_content": a.annotation_content,
            "context_text": a.context_text,
            "intent": a.intent,
            "confidence": round(a.confidence, 2),
        }
        for a in flat
    ]
    return (
        f"Paper: **{doc.source_filename}** ({doc.total_pages} pages, "
        f"{len(flat)} annotations).\n\n"
        f"<annotations>\n{json.dumps(payload, indent=2, ensure_ascii=False)}\n</annotations>\n\n"
        "Write the Claude Code prompt as markdown. No preamble."
    )


async def generate_plan_prompt(
    doc: DocumentAnnotations,
    *,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    """One Claude streaming call → returns the rendered Claude Code prompt as markdown."""
    key = api_key or settings.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set on the backend")

    client = AsyncAnthropic(api_key=key)
    user_msg = _build_user_message(doc)
    n_annotations = len(doc.flat_annotations)

    t0 = time.monotonic()
    _log(f"START {doc.source_filename} — {n_annotations} annotations, model={model or settings.claude_model}")

    # Streaming required for any request that might exceed 10 minutes.
    async with client.messages.stream(
        model=model or settings.claude_model,
        max_tokens=16384,
        system=PLANNER_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    ) as stream:
        async for event in stream:
            if getattr(event, "type", None) == "message_delta":
                usage = getattr(event, "usage", None)
                out = getattr(usage, "output_tokens", None)
                if out and out % 1000 < 100:
                    _log(f"…streaming, output={out}t at {time.monotonic() - t0:.0f}s")
        msg = await stream.get_final_message()

    elapsed = time.monotonic() - t0
    usage = getattr(msg, "usage", None)
    in_tokens = getattr(usage, "input_tokens", "?")
    out_tokens = getattr(usage, "output_tokens", "?")
    _log(
        f"finished in {elapsed:.1f}s · stop_reason={msg.stop_reason!r} · "
        f"input={in_tokens}t · output={out_tokens}t"
    )

    # Concatenate all text blocks (there should be exactly one, but be safe).
    parts: list[str] = []
    for block in msg.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    if not parts:
        raise RuntimeError(
            f"planner returned no text content; stop_reason={msg.stop_reason!r}"
        )

    prompt = "".join(parts).strip()
    _log(f"prompt rendered: {len(prompt)} chars")
    return prompt
