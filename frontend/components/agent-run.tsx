"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

type Trace = {
  type: string;
  seq: number;
  ts: number;
  text?: string;
  name?: string;
  title?: string;
  sha?: string;
  pr_url?: string;
  pr_number?: number;
  branch?: string;
};

/** Inline trace log that subscribes to /api/papers/:id/stream while the agent
 * runs. Renders every event as a single line in a monospace pane (think
 * `tail -f` for the agent). Replaces the earlier modal — the agent run IS
 * step 3 in the Apply tab; the trace lives where the user accepted from. */
export function AgentRun({
  paperId,
  prUrl,
  prNumber,
}: {
  paperId: string;
  prUrl: string | null;
  prNumber: number | null;
}) {
  const router = useRouter();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [finalPr, setFinalPr] = useState<{ url: string; number: number } | null>(
    prUrl && prNumber ? { url: prUrl, number: prNumber } : null,
  );
  const [streamError, setStreamError] = useState<string | null>(null);
  const lastSeqRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [traces]);

  useEffect(() => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001";
    const connect = () => {
      const url = `${backend}/api/papers/${paperId}/stream?since_seq=${lastSeqRef.current}`;
      const es = new EventSource(url);
      esRef.current = es;
      es.onmessage = async (e) => {
        try {
          const ev = JSON.parse(e.data) as Trace;
          if (ev.seq) lastSeqRef.current = ev.seq;
          if (ev.type === "_overflow") {
            es.close();
            connect();
            return;
          }
          if (ev.type === "_end") return;
          setTraces((t) => [...t, ev]);

          if (ev.type === "done" && ev.pr_url) {
            const next = { url: ev.pr_url, number: ev.pr_number ?? 0 };
            setFinalPr(next);
            const supabase = createClient();
            await supabase
              .from("papers")
              .update({
                status: "complete",
                pr_url: ev.pr_url,
                pr_number: ev.pr_number ?? null,
              })
              .eq("id", paperId);
            router.refresh();
            es.close();
          } else if (ev.type === "error") {
            setStreamError(ev.text ?? "Agent reported an error.");
            es.close();
            const supabase = createClient();
            await supabase
              .from("papers")
              .update({ status: "failed", error_message: ev.text ?? "agent error" })
              .eq("id", paperId);
            router.refresh();
          }
        } catch (err) {
          console.warn("trace parse error", err);
        }
      };
      es.onerror = () => {
        // browser auto-reconnects via 'retry: 2000'
      };
    };
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [paperId, router]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="kicker">
          {finalPr ? "agent complete" : streamError ? "agent failed" : "agent running"}
        </p>
        {!finalPr && !streamError && (
          <span className="kicker inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            streaming
          </span>
        )}
      </div>

      <div
        ref={logRef}
        className="max-h-[60vh] min-h-[280px] overflow-y-auto rounded-md border bg-[var(--ink)] p-3 font-mono text-[11.5px] leading-relaxed text-[var(--paper)]"
      >
        {traces.length === 0 && !streamError && (
          <div className="flex items-center gap-2 text-[var(--paper-3)]">
            <Loader2 className="size-3 animate-spin" /> waiting for first event…
          </div>
        )}
        {traces.map((t) => (
          <TraceLine key={t.seq} t={t} />
        ))}
        {streamError && (
          <div className="mt-2 text-red-400">error: {streamError}</div>
        )}
      </div>

      {finalPr && (
        <a
          href={finalPr.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "default" }), "w-full")}
        >
          <ExternalLink className="size-4" />
          Open PR #{finalPr.number}
        </a>
      )}
    </div>
  );
}

function TraceLine({ t }: { t: Trace }) {
  // Color and prefix by event kind. ASCII-only per house style.
  if (t.type === "tool") {
    return (
      <div className="py-0.5">
        <span className="text-[var(--seat-question)]">$</span>{" "}
        <span className="text-[var(--paper)]">{t.text ?? t.name}</span>
      </div>
    );
  }
  if (t.type === "tool_result") {
    return (
      <pre className="my-0.5 whitespace-pre-wrap text-[var(--paper-3)] pl-3 border-l border-[var(--ink-3)]">
        {t.text}
      </pre>
    );
  }
  if (t.type === "commit") {
    return (
      <div className="py-0.5 text-[var(--seat-insert)]">
        + commit {t.sha?.slice(0, 7) ?? "?"} -- {t.title ?? ""}
      </div>
    );
  }
  if (t.type === "done") {
    return (
      <div className="py-0.5 text-[var(--seat-insert)]">
        * done -- {t.pr_url ?? ""}
      </div>
    );
  }
  if (t.type === "error") {
    return <div className="py-0.5 text-red-400">! {t.text}</div>;
  }
  // default: think / progress
  return (
    <div className="py-0.5 text-[var(--paper-2)]">
      <span className="text-[var(--ink-3)]">.</span> {t.text ?? t.name ?? ""}
    </div>
  );
}
