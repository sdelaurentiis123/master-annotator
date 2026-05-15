"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CommentCard } from "@/components/comment-card";
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
  paperId,
  onPageJump,
  highlightId,
}: {
  doc: DocumentAnnotations;
  paperId: string;
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
          {flat.length} comment{flat.length === 1 ? "" : "s"}
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
            <CommentCard
              annotation={a}
              doc={doc}
              paperId={paperId}
              onPageJump={onPageJump}
              highlighted={highlightId === a.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
