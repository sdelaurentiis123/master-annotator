"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, GitCommit, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Plan, PlanStep, PlanStepKind, DocumentAnnotations } from "@/lib/types";

const kindStyles: Record<PlanStepKind, { cls: string; label: string; Icon: typeof GitCommit }> = {
  commit: {
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    label: "commit",
    Icon: GitCommit,
  },
  pr_comment: {
    cls: "bg-sky-50 text-sky-800 border-sky-200",
    label: "PR comment",
    Icon: MessageSquare,
  },
  manual: {
    cls: "bg-zinc-100 text-zinc-700 border-zinc-200",
    label: "manual",
    Icon: User,
  },
};

export function PlanReview({
  plan,
  doc,
  onSourceJump,
}: {
  plan: Plan;
  doc: DocumentAnnotations | null;
  onSourceJump?: (annotationId: string, page: number) => void;
}) {
  const annotationById = new Map(
    doc?.pages.flatMap((p) => p.annotations.map((a) => [a.id, a])) ?? [],
  );
  const commits = plan.steps.filter((s) => s.kind === "commit").length;
  const comments = plan.steps.filter((s) => s.kind === "pr_comment").length;
  const manual = plan.steps.filter((s) => s.kind === "manual").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Proposed plan
        </h2>
        <span className="text-xs text-muted-foreground">
          {commits} commit{commits === 1 ? "" : "s"}
          {comments > 0 && ` · ${comments} PR comment${comments === 1 ? "" : "s"}`}
          {manual > 0 && ` · ${manual} manual`}
        </span>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-border pl-3 italic">
        {plan.summary}
      </p>

      <ol className="space-y-2">
        {plan.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => (
            <Step
              key={step.id}
              step={step}
              annotationById={annotationById}
              onSourceJump={onSourceJump}
            />
          ))}
      </ol>
    </div>
  );
}

function Step({
  step,
  annotationById,
  onSourceJump,
}: {
  step: PlanStep;
  annotationById: Map<string, { page: number; intent: string }>;
  onSourceJump?: (annotationId: string, page: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const style = kindStyles[step.kind] ?? kindStyles.manual;
  const Icon = style.Icon;

  return (
    <li className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3 py-3 text-left"
      >
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {step.order}
        </span>
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{step.title}</p>
            <Badge variant="outline" className={cn("text-[10px]", style.cls)}>
              {style.label}
            </Badge>
            {step.requires_human_confirmation && (
              <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                <AlertTriangle className="size-2.5 mr-1" /> needs confirmation
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground italic">{step.rationale}</p>
        </div>
        {open ? (
          <ChevronDown className="mt-1 size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t bg-muted/30 px-3 py-3 space-y-3 text-sm">
          <p className="whitespace-pre-wrap leading-relaxed">{step.description}</p>

          {step.target_files_hint && step.target_files_hint.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Files:
              </span>
              {step.target_files_hint.map((f) => (
                <code
                  key={f}
                  className="rounded bg-card px-1.5 py-0.5 text-xs border"
                >
                  {f}
                </code>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Source annotations:
            </span>
            {step.source_annotation_ids.map((aid) => {
              const a = annotationById.get(aid);
              return (
                <button
                  key={aid}
                  onClick={() => a && onSourceJump?.(aid, a.page)}
                  className="rounded-full border bg-card px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50"
                  disabled={!a}
                >
                  {a ? `p.${a.page} · ${truncate(a.intent, 40)}` : aid}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
