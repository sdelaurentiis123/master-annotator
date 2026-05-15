"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyPromptDialog } from "@/components/copy-prompt-dialog";
import { createClient } from "@/utils/supabase/client";
import type { DocumentAnnotations, Plan, PaperStatus } from "@/lib/types";

export function AcceptActions({
  paperId,
  pdfFilename,
  doc,
  plan,
  status,
}: {
  paperId: string;
  pdfFilename: string;
  doc: DocumentAnnotations;
  plan: Plan;
  status: PaperStatus;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const accepted = status === "accepted" || status === "complete" || status === "executing";

  async function acceptAndOpen() {
    setBusy(true);
    try {
      if (!accepted) {
        const supabase = createClient();
        const { error } = await supabase
          .from("papers")
          .update({ status: "accepted" })
          .eq("id", paperId);
        if (error) throw new Error(error.message);
        toast.success("Plan accepted.");
      }
      setDialogOpen(true);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={acceptAndOpen} disabled={busy}>
          {accepted ? <Copy className="size-4" /> : <Check className="size-4" />}
          {accepted ? "Show prompt" : "Accept plan and copy prompt"}
        </Button>
      </div>
      <CopyPromptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        doc={doc}
        plan={plan}
        filename={pdfFilename}
      />
    </>
  );
}
