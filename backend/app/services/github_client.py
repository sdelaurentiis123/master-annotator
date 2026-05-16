"""Thin httpx wrapper around api.github.com. Just what the agent runner needs."""
from __future__ import annotations

import httpx


async def open_pull_request(
    *,
    token: str,
    repo_full_name: str,
    head_branch: str,
    base_branch: str,
    title: str,
    body: str,
) -> dict:
    """POST /repos/{repo}/pulls. Returns the parsed PR object."""
    url = f"https://api.github.com/repos/{repo_full_name}/pulls"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={
                "title": title,
                "body": body,
                "head": head_branch,
                "base": base_branch,
            },
        )
    if resp.status_code >= 400:
        raise RuntimeError(
            f"GitHub PR open {resp.status_code}: {resp.text[:500]}"
        )
    return resp.json()


async def detect_default_branch(token: str, repo_full_name: str) -> str:
    url = f"https://api.github.com/repos/{repo_full_name}"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            },
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"GitHub repo lookup {resp.status_code}: {resp.text[:300]}")
    return resp.json().get("default_branch", "main")
