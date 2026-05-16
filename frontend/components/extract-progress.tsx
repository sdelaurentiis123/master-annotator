"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type PageState = "pending" | "in_flight" | "done" | "failed";

// Wire-level events from the bus. `_overflow` and `_end` are bus control
// events from the SessionBus port; we handle them generically before
// narrowing onto the extract_* variants.
type BusEvent = {
  type: string;
  seq: number;
  // extract-specific fields (all optional at the wire level)
  total_pages?: number;
  total_annotations?: number;
  failed_pages?: number;
  concurrency?: number;
  rasterize_elapsed?: number;
  page?: number;
  annotations?: number;
  elapsed?: number;
  error?: string;
};

export function ExtractProgress({
  paperId,
  active,
}: {
  paperId: string;
  active: boolean;
}) {
  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState<Map<number, { state: PageState; annotations?: number; elapsed?: number }>>(
    new Map(),
  );
  const [t0] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const lastSeqRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  // Tick wall clock every 1s while active
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active, t0]);

  useEffect(() => {
    if (!active) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001";
    const connect = () => {
      const url = `${backend}/api/papers/${paperId}/stream?since_seq=${lastSeqRef.current}`;
      const es = new EventSource(url);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as BusEvent;
          if (ev.seq) lastSeqRef.current = ev.seq;
          if (ev.type === "_overflow") {
            es.close();
            connect();
            return;
          }
          if (ev.type === "_end") return;

          if (ev.type === "extract_start" && typeof ev.total_pages === "number") {
            // Reset: a fresh extraction is starting. Wipe any stale page state
            // from a previous run that may still be in the bus backlog.
            setTotal(ev.total_pages);
            const init = new Map<number, { state: PageState }>();
            for (let i = 1; i <= ev.total_pages; i++) init.set(i, { state: "pending" });
            setPages(init);
          } else if (ev.type === "extract_page_start" && typeof ev.page === "number") {
            const pageNum = ev.page;
            setPages((p) => new Map(p).set(pageNum, { state: "in_flight" }));
          } else if (ev.type === "extract_page_done" && typeof ev.page === "number") {
            const pageNum = ev.page;
            setPages((p) =>
              new Map(p).set(pageNum, {
                state: "done",
                annotations: ev.annotations ?? 0,
                elapsed: ev.elapsed ?? 0,
              }),
            );
          } else if (ev.type === "extract_page_failed" && typeof ev.page === "number") {
            const pageNum = ev.page;
            setPages((p) =>
              new Map(p).set(pageNum, { state: "failed", elapsed: ev.elapsed ?? 0 }),
            );
          } else if (ev.type === "extract_done") {
            es.close();
          }
        } catch (err) {
          console.warn("extract progress parse error", err);
        }
      };
      es.onerror = () => {
        // Auto-reconnect handled by browser via 'retry:' header
      };
    };
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [active, paperId]);

  if (!active) return null;

  const done = [...pages.values()].filter((p) => p.state === "done" || p.state === "failed").length;
  const inFlight = [...pages.values()].filter((p) => p.state === "in_flight").length;
  const totalAnnotations = [...pages.values()].reduce((s, p) => s + (p.annotations ?? 0), 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          Extracting {total ? `${done} / ${total}` : "…"}
        </p>
        <p className="kicker">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} elapsed
          {inFlight > 0 ? ` · ${inFlight} in flight` : ""}
          {totalAnnotations > 0 ? ` · ${totalAnnotations} annotations` : ""}
        </p>
      </div>

      {/* Macro progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded bg-[var(--paper-3)]">
        <div
          className="h-full bg-[var(--clay)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Per-page strip */}
      {total ? (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
            const p = pages.get(n);
            return (
              <span
                key={n}
                title={
                  p?.state === "done"
                    ? `p.${n} — ${p.annotations ?? 0} annotations in ${p.elapsed?.toFixed(0)}s`
                    : p?.state === "failed"
                      ? `p.${n} — failed`
                      : p?.state === "in_flight"
                        ? `p.${n} — running…`
                        : `p.${n} — pending`
                }
                className={cn(
                  "inline-flex h-5 min-w-[2rem] items-center justify-center rounded text-[10px] font-mono",
                  p?.state === "done" && "bg-[var(--seat-insert)] text-white",
                  p?.state === "failed" && "bg-[var(--danger)] text-white",
                  p?.state === "in_flight" && "bg-[var(--clay)] text-white animate-pulse",
                  (!p || p.state === "pending") && "bg-[var(--paper-3)] text-muted-foreground",
                )}
              >
                {n}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="kicker">connecting…</p>
      )}
    </div>
  );
}
