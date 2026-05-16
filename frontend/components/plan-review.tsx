"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/types";

export function PlanReview({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="kicker">Plan</p>
          {plan.summary && (
            <p className="font-serif text-base leading-snug truncate">{plan.summary}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="kicker">{plan.prompt.length.toLocaleString()} chars</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>
      {open && (
        <div className="border-t bg-[var(--paper-3)]/40 px-3 pb-3 pt-2">
          <div className="max-h-[50vh] overflow-y-auto rounded-md border bg-card p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed">
            {plan.prompt}
          </div>
        </div>
      )}
    </div>
  );
}
