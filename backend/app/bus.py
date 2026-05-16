"""Per-paper SSE event bus — ported from Quorum's session bus.

Producer (the agent runner) calls publish(). N subscribers each hold an
asyncio.Queue. Backlog is a bounded deque (~10k events); subscribers can
reconnect with ?since_seq=N and replay missed events. If a subscriber queue
fills, an _overflow control event is emitted; the frontend reconnects with
since_seq=<last> to resync from the backlog deque.
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

BACKLOG_MAXLEN = 10_000
SUBSCRIBER_QUEUE_MAX = 1_000


@dataclass
class SessionBus:
    session_id: str
    _seq: int = 0
    _backlog: deque = field(default_factory=lambda: deque(maxlen=BACKLOG_MAXLEN))
    _subscribers: set[asyncio.Queue] = field(default_factory=set)
    _closed: bool = False
    _empty_since: float | None = None

    def publish(self, event: dict[str, Any]) -> None:
        if self._closed:
            return
        self._seq += 1
        ev = {
            **event,
            "seq": self._seq,
            "session_id": self.session_id,
            "ts": time.time(),
        }
        self._backlog.append(ev)
        overflow_ev = {
            "type": "_overflow",
            "seq": self._seq,
            "session_id": self.session_id,
            "ts": time.time(),
        }
        for q in list(self._subscribers):
            try:
                q.put_nowait(ev)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(overflow_ev)
                except asyncio.QueueFull:
                    pass

    async def subscribe(self, since_seq: int = 0) -> AsyncIterator[dict]:
        q: asyncio.Queue = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_MAX)
        self._subscribers.add(q)
        self._empty_since = None
        try:
            for ev in list(self._backlog):
                if ev["seq"] > since_seq:
                    await q.put(ev)
            while True:
                ev = await q.get()
                if ev.get("type") == "_end":
                    break
                yield ev
        finally:
            self._subscribers.discard(q)
            if not self._subscribers:
                self._empty_since = time.monotonic()

    @property
    def has_subscribers(self) -> bool:
        return bool(self._subscribers)

    @property
    def last_seq(self) -> int:
        return self._seq

    @property
    def is_closed(self) -> bool:
        return self._closed

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        end_ev = {
            "type": "_end",
            "seq": self._seq + 1,
            "session_id": self.session_id,
            "ts": time.time(),
        }
        for q in list(self._subscribers):
            try:
                q.put_nowait(end_ev)
            except asyncio.QueueFull:
                pass


# Process-local registry keyed by paper_id. A bus lives for the lifetime of
# the process; producers and subscribers reuse the same instance no matter
# how many times the user retries. Frontend uses "<feature>_start" events
# (extract_start, agent_start) to reset its local state when a new run kicks
# off; old backlog entries can be filtered out by tracking the seq of the
# most recent start event.
_BUSES: dict[str, SessionBus] = {}


def get_or_create(paper_id: str) -> SessionBus:
    bus = _BUSES.get(paper_id)
    if bus is None:
        bus = SessionBus(session_id=paper_id)
        _BUSES[paper_id] = bus
    # The bus may never close in this model; if it somehow did (e.g. an
    # explicit close() somewhere we cleaned up), re-open for new events.
    bus._closed = False  # noqa: SLF001 — intentional flag flip
    return bus


def get(paper_id: str) -> SessionBus | None:
    return _BUSES.get(paper_id)
