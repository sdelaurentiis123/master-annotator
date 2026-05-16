"use client";

import { Sparkles } from "lucide-react";
import type { Plan } from "@/lib/types";

export function PlanReview({ plan }: { plan: Plan }) {
  // Strip code-fence / heading noise to give a quick scan-preview.
  const preview = plan.prompt
    .replace(/^#\s+.*$/m, "")
    .trim()
    .slice(0, 320);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[var(--clay)]" />
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Plan ready
        </h2>
        <span className="kicker ml-auto">{plan.prompt.length.toLocaleString()} chars</span>
      </div>
      {plan.summary && (
        <p className="font-serif text-base leading-snug">{plan.summary}</p>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
        {preview}…
      </p>
    </div>
  );
}
