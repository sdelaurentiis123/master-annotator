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
  currentPage,
  onPageJump,
  highlightId,
}: {
  doc: DocumentAnnotations;
  paperId: string;
  currentPage?: number;
  onPageJump?: (page: number, annotationId?: string) => void;
  highlightId?: string | null;
}) {
  const [filter, setFilter] = useState<"all" | ReviewerIntent>("all");
  const [scope, setScope] = useState<"page" | "all">("page");

  const flat = useMemo(
    () => doc.pages.flatMap((p) => p.annotations),
    [doc],
  );

  const scoped = useMemo(() => {
    if (scope === "all" || !currentPage) return flat;
    return flat.filter((a) => a.page === currentPage);
  }, [flat, scope, currentPage]);

  const filtered = useMemo(() => {
    if (filter === "all") return scoped;
    return scoped.filter((a) => a.reviewer_intent === filter);
  }, [scoped, filter]);

  const intentCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of scoped) {
      const k = a.reviewer_intent ?? "unclassified";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [scoped]);

  const lowConfidence = scoped.filter((a) => a.confidence < 0.6).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {scope === "page"
            ? `Page ${currentPage} · ${scoped.length} comment${scoped.length === 1 ? "" : "s"}`
            : `All pages · ${flat.length} comment${flat.length === 1 ? "" : "s"}`}
        </h2>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setScope("page")}
            className={cn(
              "rounded-full border px-2.5 py-0.5 transition-colors",
              scope === "page"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            This page
          </button>
          <button
            onClick={() => setScope("all")}
            className={cn(
              "rounded-full border px-2.5 py-0.5 transition-colors",
              scope === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            All ({flat.length})
          </button>
        </div>
      </div>

      {lowConfidence > 0 && (
        <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
          {lowConfidence} low confidence
        </Badge>
      )}

      <div className="flex flex-wrap gap-1">
        {INTENT_FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? scoped.length
              : intentCounts.get(f.value as string) ?? 0;
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

      {/* Bounded scroll. Height stretches to fill remaining viewport; cards scroll inside. */}
      <ul className="space-y-2 overflow-y-auto pr-1 max-h-[calc(100vh-360px)] min-h-[300px]">
        {filtered.length === 0 && (
          <li className="rounded-lg border border-dashed bg-card px-3 py-6 text-center text-sm text-muted-foreground">
            {scope === "page" && (scoped.length === 0)
              ? "No annotations on this page."
              : "No annotations match this filter."}
          </li>
        )}
        {filtered.map((a) => (
          <li key={a.id}>
            <CommentCard
              annotation={a}
              doc={doc}
              paperId={paperId}
              onPageJump={(p) => onPageJump?.(p, a.id)}
              highlighted={highlightId === a.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
