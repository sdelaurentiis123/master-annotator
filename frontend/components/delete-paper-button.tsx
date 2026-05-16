"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export function DeletePaperButton({
  paperId,
  pdfPath,
  filename,
}: {
  paperId: string;
  pdfPath: string;
  filename: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const supabase = createClient();
      // Remove the storage object first so we never leave an orphaned row pointing
      // at a deleted blob.
      const { error: storErr } = await supabase.storage.from("papers").remove([pdfPath]);
      if (storErr) {
        // Don't bail — proceed to delete the row anyway. The blob might already be gone.
        console.warn("storage remove warning:", storErr.message);
      }
      const { error } = await supabase.from("papers").delete().eq("id", paperId);
      if (error) throw new Error(error.message);
      toast.success("Paper deleted");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Delete failed: ${message}`);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Delete paper"
      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
