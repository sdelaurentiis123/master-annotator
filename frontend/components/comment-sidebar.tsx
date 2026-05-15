"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { IntentBadge } from "@/components/intent-badge";
import type { DocumentAnnotations, ReviewerIntent } from "@/lib/types";

const INTENT_FILTERS: { value: "all" | ReviewerIntent; label: string }[] = [
  { value: "all", label: "All" },
  { value: "insert", label: "Insert" },
  { value: "delete", label: "Delete" },
  { value: "update", label: "Update" },
  { value: "methodological_error", label: "Methodological" },
  { value: "question", label: "Question" },
  { value: "confusion", label: "Confusion" },
  { value: "critique", label: "Critique" },
];

export function CommentSidebar({
  doc,
  onPageJump,
  highlightId,
}: {
  doc: DocumentAnnotations;
  onPageJump?: (page: number) => void;
  highlightId?: string | null;
}) {
  const [filter, setFilter] = useState<"all" | ReviewerIntent>("all");

  const flat = useMemo(
    () => doc.pages.flatMap((p) => p.annotations),
    [doc],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return flat;
    return flat.filter((a) => a.reviewer_intent === filter);
  }, [flat, filter]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of flat) {
      const k = a.reviewer_intent ?? "unclassified";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [flat]);

  const lowConfidence = flat.filter((a) => a.confidence < 0.6).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {flat.length} comments
        </h2>
        {lowConfidence > 0 && (
          <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
            {lowConfidence} low confidence
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {INTENT_FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? flat.length
              : counts.get(f.value as string) ?? 0;
          if (f.value !== "all" && count === 0) return null;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                filter === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label} · {count}
            </button>
          );
        })}
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 && (
          <li className="rounded-lg border border-dashed bg-card px-3 py-6 text-center text-sm text-muted-foreground">
            No annotations match this filter.
          </li>
        )}
        {filtered.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => onPageJump?.(a.page)}
              data-aid={a.id}
              className={cn(
                "group w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/30",
                highlightId === a.id && "ring-2 ring-amber-400 bg-amber-50",
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                {a.reviewer_intent ? (
                  <IntentBadge intent={a.reviewer_intent} />
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    unclassified
                  </Badge>
                )}
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                  p. {a.page} <ChevronRight className="size-3" />
                </span>
              </div>
              <p className="text-sm">{a.intent}</p>
              {a.anchor_text && (
                <p className="mt-1 truncate text-xs italic text-muted-foreground">
                  &ldquo;{a.anchor_text}&rdquo;
                </p>
              )}
              {a.annotation_content && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {a.annotation_content}
                </p>
              )}
              <div className="mt-2 h-1 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-foreground/60"
                  style={{ width: `${Math.round(a.confidence * 100)}%` }}
                />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
