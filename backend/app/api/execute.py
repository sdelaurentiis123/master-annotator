"""POST /api/papers/{id}/execute  +  GET /api/papers/{id}/stream

The execute route loads `plan.prompt` from the supplied body, spawns an asyncio
task running the agent (clone + tool-loop + push + open PR), and returns
immediately. The frontend subscribes to /stream via EventSource.
"""
from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app import bus
from app.services import agent_runner

router = APIRouter()


class ExecuteRequest(BaseModel):
    repo_full_name: str
    github_token: str
    plan_prompt: str  # the markdown Claude Code prompt from papers.plan.prompt


async def _run_with_swallow(coro):
    """Swallow agent_runner exceptions — they've already been published to the
    bus as `error` events. We don't want unhandled task errors crashing uvicorn."""
    try:
        await coro
    except Exception:
        pass


@router.post("/api/papers/{paper_id}/execute")
async def execute_route(paper_id: str, req: ExecuteRequest) -> dict:
    if not req.repo_full_name or "/" not in req.repo_full_name:
        raise HTTPException(status_code=400, detail="repo_full_name must look like owner/repo")
    if not req.github_token:
        raise HTTPException(status_code=400, detail="github_token required")
    if not req.plan_prompt.strip():
        raise HTTPException(status_code=400, detail="plan_prompt empty")

    asyncio.create_task(
        _run_with_swallow(
            agent_runner.run(
                paper_id=paper_id,
                plan_prompt=req.plan_prompt,
                repo_full_name=req.repo_full_name,
                github_token=req.github_token,
            )
        )
    )
    return {"session_id": paper_id, "started_at": time.time()}


@router.get("/api/papers/{paper_id}/stream")
async def stream_route(paper_id: str, request: Request, since_seq: int = 0):
    b = bus.get_or_create(paper_id)

    async def event_stream():
        yield "retry: 2000\n\n"
        try:
            async for ev in b.subscribe(since_seq=since_seq):
                if await request.is_disconnected():
                    break
                yield f"data: {json.dumps(ev)}\n\n"
        except asyncio.CancelledError:
            return

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
