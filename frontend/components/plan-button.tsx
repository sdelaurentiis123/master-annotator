"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generatePlan } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import type { Classification, DocumentAnnotations } from "@/lib/types";

export function PlanButton({
  paperId,
  doc,
  alreadyPlanned,
}: {
  paperId: string;
  doc: DocumentAnnotations;
  alreadyPlanned: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const supabase = createClient();
    try {
      await supabase
        .from("papers")
        .update({ status: "planning", error_message: null })
        .eq("id", paperId);

      const { classifications, plan } = await generatePlan(doc);

      // Merge classifications back onto each annotation
      const classBy = new Map<string, Classification>(
        classifications.map((c) => [c.annotation_id, c]),
      );
      const merged: DocumentAnnotations = {
        ...doc,
        pages: doc.pages.map((p) => ({
          ...p,
          annotations: p.annotations.map((a) => {
            const c = classBy.get(a.id);
            return c ? { ...a, reviewer_intent: c.reviewer_intent } : a;
          }),
        })),
      };

      const { error } = await supabase
        .from("papers")
        .update({ annotations: merged, plan, status: "planned" })
        .eq("id", paperId);
      if (error) throw new Error(`save plan: ${error.message}`);

      toast.success(
        `Plan ready: ${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"} (${plan.unactionable_count} for review)`,
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Plan generation failed: ${message}`);
      await supabase
        .from("papers")
        .update({ status: "failed", error_message: message })
        .eq("id", paperId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="default" onClick={run} disabled={busy}>
      {busy ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Planning…
        </>
      ) : (
        <>
          <Wand2 className="size-4" />
          {alreadyPlanned ? "Regenerate plan" : "Generate plan"}
        </>
      )}
    </Button>
  );
}
