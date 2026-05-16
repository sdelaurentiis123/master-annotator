"""Anthropic tool definitions + dispatcher for the agent loop.

Tools:
- read_file(path)            -> file contents (truncated for huge files)
- write_file(path, content)  -> writes the file, returns nothing
- bash(cmd, timeout_s)       -> {stdout, stderr, exit_code} truncated
- commit(message, paths)     -> stages paths, commits with message, returns sha
- done_editing(summary)      -> terminal sentinel; dispatcher raises DoneEditing
"""
from __future__ import annotations

import shlex
from dataclasses import dataclass
from typing import Any

from .agent_workspace import Workspace


TOOLS: list[dict[str, Any]] = [
    {
        "name": "read_file",
        "description": (
            "Read a file in the workspace. Path is relative to /workspace/edit. "
            "Returns the file contents (truncated to 20K chars if larger)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": (
            "Overwrite (or create) a file with the given content. "
            "Path is relative to /workspace/edit."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "bash",
        "description": (
            "Run a shell command in /workspace/edit. Returns stdout, stderr, "
            "exit_code. Stdout/stderr are truncated to 4K chars each."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "cmd": {"type": "string"},
                "timeout_s": {"type": "integer", "default": 60},
            },
            "required": ["cmd"],
        },
    },
    {
        "name": "commit",
        "description": (
            "git add the listed paths and create a commit with the given message. "
            "Returns the new commit sha (short)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string"},
                "paths": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["message", "paths"],
        },
    },
    {
        "name": "done_editing",
        "description": (
            "Terminal. Call when every addressable edit is committed (or skipped "
            "with reasons in the summary). Pass a plain-text recap."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"summary": {"type": "string"}},
            "required": ["summary"],
        },
    },
]

MAX_FILE_CHARS = 20_000
MAX_OUT_CHARS = 4_000


@dataclass
class DoneEditing(Exception):
    summary: str


@dataclass
class ToolEvent:
    """What the dispatcher publishes to the bus per tool call."""
    name: str
    text: str  # human-readable single-line summary for the trace log


async def dispatch(
    workspace: Workspace,
    name: str,
    args: dict[str, Any],
) -> tuple[str, ToolEvent]:
    """Run one tool. Returns (tool_result_string_for_claude, trace_event).

    Raises DoneEditing on the terminal tool; caller breaks the loop.
    """
    if name == "read_file":
        path = args["path"]
        try:
            content = await workspace.read_file(path)
        except FileNotFoundError:
            return f"error: file not found: {path}", ToolEvent("read_file", f"read {path} -- not found")
        truncated = len(content) > MAX_FILE_CHARS
        body = content[:MAX_FILE_CHARS] + ("\n... [truncated]" if truncated else "")
        return body, ToolEvent("read_file", f"read {path} ({len(content)} chars{', truncated' if truncated else ''})")

    if name == "write_file":
        path = args["path"]
        content = args["content"]
        await workspace.write_file(path, content)
        return f"wrote {path} ({len(content)} chars)", ToolEvent("write_file", f"write {path} ({len(content)} chars)")

    if name == "bash":
        cmd = args["cmd"]
        timeout_s = args.get("timeout_s", 60)
        try:
            res = await workspace.bash(cmd, timeout_s=timeout_s)
        except RuntimeError as e:
            return f"error: {e}", ToolEvent("bash", f"$ {cmd[:80]} -- {e}")
        out = res.stdout[:MAX_OUT_CHARS]
        err = res.stderr[:MAX_OUT_CHARS]
        body = f"exit_code: {res.exit_code}\nstdout:\n{out}\nstderr:\n{err}"
        head = f"$ {cmd[:80]} (exit={res.exit_code})"
        return body, ToolEvent("bash", head)

    if name == "commit":
        message = args["message"]
        paths = args["paths"]
        if not paths:
            return "error: at least one path required", ToolEvent("commit", f"commit failed -- no paths")
        add_cmd = "git add " + " ".join(shlex.quote(p) for p in paths)
        add_res = await workspace.bash(add_cmd)
        if add_res.exit_code != 0:
            return f"git add failed: {add_res.stderr[:500]}", ToolEvent("commit", f"git add failed")
        # -m message escaped via shlex
        commit_cmd = f"git commit -m {shlex.quote(message)}"
        c_res = await workspace.bash(commit_cmd)
        if c_res.exit_code != 0:
            return f"git commit failed: {c_res.stderr[:500]}", ToolEvent("commit", f"git commit failed -- {c_res.stderr[:80]}")
        # Get the new sha
        sha_res = await workspace.bash("git rev-parse --short HEAD")
        sha = sha_res.stdout.strip() if sha_res.exit_code == 0 else "?"
        return f"committed {sha}: {message}", ToolEvent("commit", f"{sha} {message[:80]}")

    if name == "done_editing":
        raise DoneEditing(summary=args.get("summary", ""))

    return f"unknown tool: {name}", ToolEvent(name, f"unknown tool {name}")
