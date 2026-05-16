"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generatePlan } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import type { DocumentAnnotations } from "@/lib/types";

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

      const { plan } = await generatePlan(doc);

      const { error } = await supabase
        .from("papers")
        .update({ plan, status: "planned" })
        .eq("id", paperId);
      if (error) throw new Error(`save plan: ${error.message}`);

      toast.success(`Plan ready · ${plan.prompt.length.toLocaleString()} chars`);
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
        <>{alreadyPlanned ? "Regenerate plan" : "Generate plan"}</>
      )}
    </Button>
  );
}
