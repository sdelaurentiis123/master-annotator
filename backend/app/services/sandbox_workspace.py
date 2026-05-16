"""E2B-sandbox implementation of the Workspace protocol.

Mirrors LocalWorkspace's surface so agent_runner stays workspace-agnostic.
On boot: install tectonic + git, then clone the repo and add a worktree.
"""
from __future__ import annotations

import shlex
import sys
from dataclasses import dataclass

from typing import Any

from e2b_code_interpreter import AsyncSandbox

from app.config import settings
from .agent_workspace import BashResult, _heartbeat


def _log(msg: str) -> None:
    print(f"[sandbox] {msg}", flush=True, file=sys.stderr)


class SandboxWorkspace:
    """E2B-backed workspace. /workspace/source/ holds the clone, /workspace/edit/
    is the worktree the agent operates inside."""

    def __init__(self, paper_id: str):
        self.paper_id = paper_id
        # E2B's stock python template runs as a non-root user; `/workspace`
        # isn't writable. Use the user's home, which always is.
        self.root = "/home/user/workspace"
        self.source = "/home/user/workspace/source"
        self._edit_dir = "/home/user/workspace/edit"
        self._sb: AsyncSandbox | None = None

    @property
    def edit_dir(self) -> str:
        return self._edit_dir

    @property
    def sb(self) -> AsyncSandbox:
        if self._sb is None:
            raise RuntimeError("sandbox not prepared; call prepare() first")
        return self._sb

    async def prepare(
        self,
        github_token: str,
        repo_full_name: str,
        branch: str,
        bus_: Any = None,
    ) -> None:
        api_key = settings.e2b_api_key
        if not api_key:
            raise RuntimeError("E2B_API_KEY missing on the backend")
        _log(f"creating sandbox for paper {self.paper_id}…")
        if bus_ is not None:
            bus_.publish({"type": "think", "text": "spinning up sandbox…"})
        self._sb = await AsyncSandbox.create(api_key=api_key, timeout=900)

        # 1) Install tectonic. Stock python template doesn't have it.
        _log("installing tectonic…")
        if bus_ is not None:
            bus_.publish({"type": "think", "text": "installing tectonic (LaTeX compiler)…"})
        tec_hb = asyncio.create_task(_heartbeat(bus_, "still installing tectonic"))
        try:
            # Install into ~/.local/bin (writable as the sandbox's non-root user)
            # and add it to PATH for subsequent commands.
            await self._run(
                "mkdir -p ~/.local/bin && "
                "curl --proto '=https' --tlsv1.2 -fsSL "
                "https://drop-sh.fullyjustified.net | sh -s -- -y "
                "&& mv tectonic ~/.local/bin/tectonic "
                "&& echo 'export PATH=$HOME/.local/bin:$PATH' >> ~/.bashrc "
                "&& ~/.local/bin/tectonic --version",
                cwd="/tmp",
                timeout_s=180,
                check=True,
            )
        finally:
            tec_hb.cancel()

        # 2) Clone + worktree
        clone_url = (
            f"https://x-access-token:{github_token}@github.com/{repo_full_name}.git"
        )
        await self._run(f"mkdir -p {self.root}", cwd="/", check=True)
        if bus_ is not None:
            bus_.publish({"type": "think", "text": f"cloning {repo_full_name}…"})
        clone_hb = asyncio.create_task(_heartbeat(bus_, "still cloning"))
        try:
            await self._run(
                f"git clone {shlex.quote(clone_url)} {shlex.quote(self.source)}",
                cwd=self.root,
                timeout_s=300,
                check=True,
            )
        finally:
            clone_hb.cancel()
        if bus_ is not None:
            sz = await self._run(
                f"du -sh {shlex.quote(self.source)} | cut -f1",
                cwd=self.root, check=False,
            )
            bus_.publish({"type": "think", "text": f"clone complete ({sz.stdout.strip() or '?'})"})
        await self._run(
            "git config user.email 'agent@master-annotator' && "
            "git config user.name 'annotation-agent'",
            cwd=self.source,
            check=True,
        )
        if bus_ is not None:
            bus_.publish({"type": "think", "text": f"creating worktree on {branch}…"})
        await self._run(
            f"git worktree add -B {shlex.quote(branch)} {shlex.quote(self._edit_dir)}",
            cwd=self.source,
            timeout_s=30,
            check=True,
        )
        _log(f"sandbox ready: clone + worktree on {branch}")

    async def read_file(self, rel_path: str) -> str:
        full = self._join(rel_path)
        return await self.sb.files.read(full)

    async def write_file(self, rel_path: str, content: str) -> None:
        full = self._join(rel_path)
        await self.sb.files.write(full, content)

    async def bash(self, cmd: str, timeout_s: int = 60) -> BashResult:
        return await self._run(cmd, cwd=self._edit_dir, timeout_s=timeout_s, check=False)

    async def push(self, branch: str) -> BashResult:
        return await self._run(
            f"git push -u origin {shlex.quote(branch)}",
            cwd=self._edit_dir,
            timeout_s=120,
            check=False,
        )

    async def teardown(self) -> None:
        if self._sb is not None:
            try:
                await self._sb.kill()
            except Exception:
                pass
            self._sb = None
            _log("sandbox torn down")

    # --- internals -------------------------------------------------------

    def _join(self, rel: str) -> str:
        rel = rel.lstrip("/")
        if ".." in rel.split("/"):
            raise ValueError(f"path escapes edit dir: {rel}")
        return f"{self._edit_dir}/{rel}"

    async def _run(
        self,
        cmd: str,
        *,
        cwd: str,
        timeout_s: int = 60,
        check: bool = False,
    ) -> BashResult:
        # E2B's commands.run runs the cmd via bash -lc inside the sandbox.
        # Compose `cd <cwd> && <cmd>` so we don't depend on a working-directory
        # API, and prepend ~/.local/bin to PATH so the agent's `tectonic` and
        # anything else we installed there is reachable from inside bash too.
        full = f"export PATH=$HOME/.local/bin:$PATH && cd {shlex.quote(cwd)} && {cmd}"
        exec_ = await self.sb.commands.run(full, timeout=timeout_s)
        result = BashResult(
            stdout=getattr(exec_, "stdout", "") or "",
            stderr=getattr(exec_, "stderr", "") or "",
            exit_code=getattr(exec_, "exit_code", -1),
        )
        if check and result.exit_code != 0:
            raise RuntimeError(
                f"sandbox bash failed [{result.exit_code}]: {cmd[:120]}\n"
                f"stderr: {result.stderr[:500]}"
            )
        return result
