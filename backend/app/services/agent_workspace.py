"""Workspace abstraction for the agent loop.

Two implementations:
- LocalWorkspace: subprocess + plain filesystem under /tmp (slice 12, local dev).
- SandboxWorkspace: wraps e2b's AsyncSandbox (slice 13).

The agent tool dispatcher in `agent_tools.py` is workspace-agnostic; it only
calls these methods.
"""
from __future__ import annotations

import asyncio
import os
import shlex
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol


async def _heartbeat(bus_: Any, label: str, interval_s: float = 5.0) -> None:
    """Publish a `think` event every `interval_s` until cancelled. Lets the
    UI show something while a long-running step (git clone) is happening."""
    if bus_ is None:
        # No bus — sleep forever; the caller will cancel us.
        while True:
            await asyncio.sleep(interval_s)
    t0 = time.monotonic()
    while True:
        await asyncio.sleep(interval_s)
        try:
            bus_.publish({
                "type": "think",
                "text": f"{label}… {int(time.monotonic() - t0)}s elapsed",
            })
        except Exception:
            return


def _log(msg: str) -> None:
    print(f"[agent] {msg}", flush=True, file=sys.stderr)


@dataclass
class BashResult:
    stdout: str
    stderr: str
    exit_code: int


class Workspace(Protocol):
    """Everything the agent loop needs from its environment."""

    edit_dir: str  # logical path the agent treats as cwd (e.g. /workspace/edit)

    async def read_file(self, rel_path: str) -> str: ...
    async def write_file(self, rel_path: str, content: str) -> None: ...
    async def bash(self, cmd: str, timeout_s: int = 60) -> BashResult: ...
    async def teardown(self) -> None: ...


class LocalWorkspace:
    """Filesystem-backed workspace at /tmp/master-annotator-runs/<paper_id>.

    Layout:
      /tmp/master-annotator-runs/<id>/source/  (the clone — has .git)
      /tmp/master-annotator-runs/<id>/edit/    (git worktree, agent's cwd)
    """

    def __init__(self, paper_id: str):
        self.paper_id = paper_id
        self.root = Path(f"/tmp/master-annotator-runs/{paper_id}").resolve()
        self.source_dir = self.root / "source"
        self.edit_dir_path = self.root / "edit"

    @property
    def edit_dir(self) -> str:
        return str(self.edit_dir_path)

    async def prepare(
        self,
        github_token: str,
        repo_full_name: str,
        branch: str,
        bus_: Any = None,
    ) -> None:
        """Clone the repo and add a worktree on `branch`."""
        # Nuke any prior run for this paper
        if self.root.exists():
            await asyncio.to_thread(shutil.rmtree, self.root)
        self.root.mkdir(parents=True, exist_ok=True)
        _log(f"prepare: workspace at {self.root}")

        clone_url = f"https://x-access-token:{github_token}@github.com/{repo_full_name}.git"
        if bus_ is not None:
            bus_.publish({"type": "think", "text": f"cloning {repo_full_name}…"})
        hb = asyncio.create_task(_heartbeat(bus_, "still cloning"))
        try:
            await self._run(
                f"git clone {shlex.quote(clone_url)} {shlex.quote(str(self.source_dir))}",
                cwd=str(self.root),
                timeout_s=300,
                check=True,
            )
        finally:
            hb.cancel()
        if bus_ is not None:
            # Quick size report so the user sees what they downloaded.
            size_res = await self._run(
                f"du -sh {shlex.quote(str(self.source_dir))} | cut -f1",
                cwd=str(self.root),
                check=False,
            )
            bus_.publish({
                "type": "think",
                "text": f"clone complete ({size_res.stdout.strip() or '?'})",
            })

        await self._run(
            "git config user.email 'agent@master-annotator' && "
            "git config user.name 'annotation-agent'",
            cwd=str(self.source_dir),
            check=True,
        )
        # Worktree on the agent's branch. Refuses if branch exists; use -B to overwrite.
        if bus_ is not None:
            bus_.publish({"type": "think", "text": f"creating worktree on {branch}…"})
        await self._run(
            f"git worktree add -B {shlex.quote(branch)} "
            f"{shlex.quote(str(self.edit_dir_path))}",
            cwd=str(self.source_dir),
            timeout_s=30,
            check=True,
        )
        _log(f"prepare: worktree on {branch} at {self.edit_dir_path}")

    async def read_file(self, rel_path: str) -> str:
        target = self._safe_path(rel_path)
        return await asyncio.to_thread(target.read_text, encoding="utf-8")

    async def write_file(self, rel_path: str, content: str) -> None:
        target = self._safe_path(rel_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(target.write_text, content, encoding="utf-8")

    async def bash(self, cmd: str, timeout_s: int = 60) -> BashResult:
        return await self._run(cmd, cwd=str(self.edit_dir_path), timeout_s=timeout_s, check=False)

    async def push(self, branch: str) -> BashResult:
        return await self._run(
            f"git push -u origin {shlex.quote(branch)}",
            cwd=str(self.edit_dir_path),
            timeout_s=120,
            check=False,
        )

    async def teardown(self) -> None:
        # Leave it on disk by default; useful for debugging. Manual cleanup:
        #   rm -rf /tmp/master-annotator-runs/<paper_id>
        return None

    # --- internals -------------------------------------------------------

    def _safe_path(self, rel: str) -> Path:
        # Resist path traversal: ensure resolved path stays under edit_dir
        target = (self.edit_dir_path / rel).resolve()
        if not str(target).startswith(str(self.edit_dir_path)):
            raise ValueError(f"path escapes edit dir: {rel}")
        return target

    async def _run(
        self, cmd: str, *, cwd: str, timeout_s: int = 60, check: bool = False
    ) -> BashResult:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout_s)
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError(f"bash timeout after {timeout_s}s: {cmd[:120]}")
        result = BashResult(
            stdout=stdout_b.decode("utf-8", errors="replace"),
            stderr=stderr_b.decode("utf-8", errors="replace"),
            exit_code=proc.returncode if proc.returncode is not None else -1,
        )
        if check and result.exit_code != 0:
            raise RuntimeError(
                f"bash failed [{result.exit_code}]: {cmd[:120]}\n"
                f"stderr: {result.stderr[:500]}"
            )
        return result
