"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Phase = "extract" | "plan" | "apply";

const PHASES: { id: Phase; label: string }[] = [
  { id: "extract", label: "Extract" },
  { id: "plan", label: "Plan" },
  { id: "apply", label: "Apply" },
];

export function WorkspaceTabs({
  current,
  reached,
  onChange,
}: {
  current: Phase;
  /** Set of phases the user can actually visit (prerequisites met). */
  reached: Set<Phase>;
  onChange: (p: Phase) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {PHASES.map((p, i) => {
        const isCurrent = current === p.id;
        const isReached = reached.has(p.id);
        const isComplete =
          isReached && PHASES.indexOf({ id: p.id, label: p.label } as any) < PHASES.findIndex((x) => x.id === current);
        const completed =
          isReached && (i < PHASES.findIndex((x) => x.id === current) || isPhaseAfter(p.id, reached));
        return (
          <div key={p.id} className="flex items-center gap-3">
            <button
              onClick={() => isReached && onChange(p.id)}
              disabled={!isReached}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                isCurrent
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                  : isReached
                    ? "border-[var(--rule)] bg-[var(--paper-2)] hover:bg-[var(--paper-3)]"
                    : "border-[var(--rule)] bg-[var(--paper-2)] text-muted-foreground opacity-50 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px] font-medium",
                  isCurrent
                    ? "border-[var(--paper)] bg-[var(--paper)] text-[var(--ink)]"
                    : completed
                      ? "border-[var(--clay)] bg-[var(--clay)] text-[var(--paper)]"
                      : "border-[var(--rule)] bg-transparent",
                )}
              >
                {completed && !isCurrent ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="font-medium">{p.label}</span>
            </button>
            {i < PHASES.length - 1 && (
              <span
                className={cn(
                  "h-px w-6",
                  reached.has(PHASES[i + 1].id) ? "bg-[var(--clay)]" : "bg-[var(--rule)]",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function isPhaseAfter(p: Phase, reached: Set<Phase>): boolean {
  // helper unused; kept signature for future use
  return reached.has(p);
}
