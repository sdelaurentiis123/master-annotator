"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

type Trace = {
  type: string;
  seq: number;
  ts: number;
  text?: string;
  title?: string;
  sha?: string;
  pr_url?: string;
  pr_number?: number;
  note?: string;
};

const ICON: Record<string, string> = {
  think: "·",
  tool: "$",
  commit: ">",
  compile_failed: "!",
  done: "✓".replace("✓", "*"), // ASCII-only per house style
  error: "!",
};

export function AgentProgressModal({
  open,
  onOpenChange,
  paperId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paperId: string;
}) {
  const router = useRouter();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [finalPr, setFinalPr] = useState<{ url: string; number: number } | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const lastSeqRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the trace log as new events arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [traces]);

  useEffect(() => {
    if (!open) {
      // Close any existing source on dialog close
      esRef.current?.close();
      esRef.current = null;
      return;
    }

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
            // Reconnect from last-known seq to fill the gap
            es.close();
            connect();
            return;
          }
          if (ev.type === "_end") return;
          setTraces((t) => [...t, ev]);
          if (ev.type === "done" && ev.pr_url) {
            setFinalPr({ url: ev.pr_url, number: ev.pr_number ?? 0 });
            // Persist to Supabase so the paper page reflects it on refresh
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
          }
          if (ev.type === "error") {
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
        // Browser will auto-reconnect using the 'retry: 2000' hint we send.
        // We just log it; no toast spam.
        console.warn("EventSource error, will reconnect");
      };
    };
    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [open, paperId, router]);

  function fmtTrace(t: Trace): string {
    const icon = ICON[t.type] ?? "·";
    const head =
      t.type === "commit"
        ? `commit ${t.sha?.slice(0, 7) ?? ""}: ${t.title ?? ""}`
        : t.type === "tool"
          ? t.text ?? ""
          : t.type === "done"
            ? `done -- ${t.pr_url ?? ""}`
            : t.text ?? t.title ?? "";
    return `${icon}  ${head}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Agent at work</DialogTitle>
          <DialogDescription>
            Live trace from the sandbox. The agent clones your repo, applies the plan,
            runs a compile check, and opens a pull request.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={logRef}
          className="max-h-[55vh] min-h-[280px] overflow-y-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed"
        >
          {traces.length === 0 && !streamError && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> waiting for first event…
            </div>
          )}
          {traces.map((t) => (
            <div key={t.seq} className="py-0.5">
              {fmtTrace(t)}
            </div>
          ))}
          {streamError && <div className="py-1 text-destructive">error: {streamError}</div>}
        </div>

        <DialogFooter>
          {finalPr ? (
            <a
              href={finalPr.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "default" })}
            >
              <ExternalLink className="size-4" />
              Open PR #{finalPr.number}
            </a>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hide (agent keeps running)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
