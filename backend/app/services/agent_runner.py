"""End-to-end agent run: clone -> tool-use loop -> push -> open PR.

Slice 12: local filesystem workspace. Slice 13 swaps in E2B.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

from anthropic import AsyncAnthropic

from app import bus
from app.config import settings
from app.services import agent_tools, github_client
from app.services.agent_tools import DoneEditing
from app.services.agent_workspace import LocalWorkspace, Workspace


def _default_workspace_factory(paper_id: str):
    """Choose the workspace impl based on settings.agent_workspace."""
    if settings.agent_workspace == "local":
        return LocalWorkspace(paper_id)
    # Lazy import so missing e2b dep only blows up when actually used.
    from app.services.sandbox_workspace import SandboxWorkspace
    return SandboxWorkspace(paper_id)


SYSTEM_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "agent.md"
SYSTEM_PROMPT = SYSTEM_PROMPT_PATH.read_text()


def _log(msg: str) -> None:
    print(f"[agent] {msg}", flush=True, file=sys.stderr)


def _branch_name(paper_id: str) -> str:
    return f"annotation-agent/{paper_id[:8]}"


async def run(
    *,
    paper_id: str,
    plan_prompt: str,
    repo_full_name: str,
    github_token: str,
    anthropic_api_key: str | None = None,
    model: str | None = None,
    workspace_factory=None,
    max_turns: int = 100,
) -> dict:
    """Drive one paper through the agent loop. Returns the PR dict or raises."""
    b = bus.get_or_create(paper_id)
    factory = workspace_factory or (lambda: _default_workspace_factory(paper_id))
    branch = _branch_name(paper_id)

    try:
        ws: Workspace = factory()
        # agent_start is the signal the frontend uses to clear its local
        # trace state. Always publish it as the FIRST event of a run.
        b.publish({"type": "agent_start", "branch": branch, "repo": repo_full_name})
        b.publish({"type": "think", "text": f"preparing workspace…"})
        base_branch = await github_client.detect_default_branch(github_token, repo_full_name)
        b.publish({"type": "think", "text": f"base branch: {base_branch}"})
        await ws.prepare(github_token, repo_full_name, branch, bus_=b)  # type: ignore[attr-defined]
        b.publish({"type": "think", "text": f"clone + worktree ready on {branch}"})

        await _agent_loop(
            ws=ws,
            plan_prompt=plan_prompt,
            bus_=b,
            anthropic_api_key=anthropic_api_key,
            model=model,
            max_turns=max_turns,
        )

        b.publish({"type": "think", "text": "pushing branch…"})
        push_res = await ws.push(branch)  # type: ignore[attr-defined]
        if push_res.exit_code != 0:
            raise RuntimeError(f"git push failed: {push_res.stderr[:500]}")

        b.publish({"type": "think", "text": "opening PR…"})
        title = _pr_title(plan_prompt)
        body = _pr_body(plan_prompt)
        pr = await github_client.open_pull_request(
            token=github_token,
            repo_full_name=repo_full_name,
            head_branch=branch,
            base_branch=base_branch,
            title=title,
            body=body,
        )
        b.publish({
            "type": "done",
            "pr_url": pr["html_url"],
            "pr_number": pr["number"],
            "branch": branch,
        })
        return pr
    except Exception as e:
        b.publish({"type": "error", "text": f"{type(e).__name__}: {e}"})
        raise
    finally:
        # Best-effort cleanup of the workspace. Don't close the bus -- it stays
        # alive in the registry so a late-connecting subscriber can replay
        # the backlog up to the latest 'done' / 'error' event.
        try:
            await ws.teardown()  # type: ignore[attr-defined]
        except Exception:
            pass


async def _agent_loop(
    *,
    ws: Workspace,
    plan_prompt: str,
    bus_,
    anthropic_api_key: str | None,
    model: str | None,
    max_turns: int,
) -> None:
    """Anthropic streaming tool-use loop. Terminates on done_editing."""
    key = anthropic_api_key or settings.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY missing")
    client = AsyncAnthropic(api_key=key)

    messages: list[dict] = [
        {
            "role": "user",
            "content": (
                "Apply the following Claude Code prompt to the LaTeX repo at "
                "/workspace/edit. Use the tools to read, edit, compile-check, "
                "and commit. Call done_editing when complete.\n\n"
                f"{plan_prompt}"
            ),
        }
    ]

    for turn in range(1, max_turns + 1):
        bus_.publish({"type": "think", "text": f"turn {turn}: thinking…"})
        t0 = time.monotonic()
        async with client.messages.stream(
            model=model or settings.claude_model,
            max_tokens=16384,
            system=SYSTEM_PROMPT,
            tools=agent_tools.TOOLS,
            messages=messages,
        ) as stream:
            msg = await stream.get_final_message()
        elapsed = time.monotonic() - t0
        usage = getattr(msg, "usage", None)
        out_tok = getattr(usage, "output_tokens", "?")
        _log(f"turn {turn} done in {elapsed:.1f}s, stop_reason={msg.stop_reason!r}, output={out_tok}t")

        # Collect any plain-text "thinking" first
        for block in msg.content:
            if getattr(block, "type", None) == "text" and block.text.strip():
                bus_.publish({"type": "think", "text": block.text.strip()[:400]})

        if msg.stop_reason != "tool_use":
            # Model decided it's done without calling done_editing. Treat as
            # completion — but warn.
            bus_.publish({"type": "think", "text": f"model stopped with {msg.stop_reason!r}; ending loop"})
            return

        # Append assistant turn to history
        messages.append({"role": "assistant", "content": msg.content})

        # Execute each tool_use block and gather tool_results
        tool_results: list[dict] = []
        terminated = None
        for block in msg.content:
            if getattr(block, "type", None) != "tool_use":
                continue
            try:
                result_text, trace = await agent_tools.dispatch(ws, block.name, block.input)
            except DoneEditing as d:
                terminated = d
                break
            bus_.publish({"type": "tool", "name": trace.name, "text": trace.text})
            # Also publish the (truncated) tool result so the frontend can show
            # actual command output instead of just the "$ cmd" header.
            bus_.publish({
                "type": "tool_result",
                "name": trace.name,
                "text": result_text[:1500],
            })
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result_text,
            })

        if terminated is not None:
            bus_.publish({"type": "think", "text": f"done_editing: {terminated.summary[:400]}"})
            return

        if not tool_results:
            bus_.publish({"type": "think", "text": "no tool calls this turn; ending loop"})
            return

        messages.append({"role": "user", "content": tool_results})

    raise RuntimeError(f"agent exceeded max turns ({max_turns})")


def _pr_title(plan_prompt: str) -> str:
    for line in plan_prompt.splitlines():
        if line.startswith("# "):
            return line.lstrip("# ").strip()[:120]
    return "Address reviewer annotations"


def _pr_body(plan_prompt: str) -> str:
    return (
        "Reviewer marginalia applied by the master-annotator agent.\n\n"
        "---\n\n"
        f"{plan_prompt}"
    )
