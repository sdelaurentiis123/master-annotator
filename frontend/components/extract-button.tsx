"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BackendError } from "@/lib/api";
import { createClient } from "@/utils/supabase/client";
import type { Annotation, DocumentAnnotations } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001";

async function extractAnnotationsWithProgress(
  pdfBlob: Blob,
  filename: string,
  paperId: string,
): Promise<DocumentAnnotations> {
  const fd = new FormData();
  fd.append("file", pdfBlob, filename);
  fd.append("paper_id", paperId); // backend will publish per-page progress to this paper's bus
  const resp = await fetch(`${BACKEND_URL}/api/extract`, { method: "POST", body: fd });
  if (!resp.ok) {
    const text = await resp.text();
    throw new BackendError(resp.status, text);
  }
  return (await resp.json()) as DocumentAnnotations;
}

type Props = {
  paperId: string;
  pdfUrl: string;
  pdfFilename: string;
  alreadyExtracted: boolean;
};

export function ExtractButton({ paperId, pdfUrl, pdfFilename, alreadyExtracted }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const supabase = createClient();
    try {
      await supabase
        .from("papers")
        .update({ status: "extracting", error_message: null })
        .eq("id", paperId);
      router.refresh();

      const pdfResp = await fetch(pdfUrl);
      if (!pdfResp.ok) throw new Error(`fetch pdf: ${pdfResp.status}`);
      const blob = await pdfResp.blob();

      const doc: DocumentAnnotations = await extractAnnotationsWithProgress(
        blob,
        pdfFilename,
        paperId,
      );

      const totalAnnotations = doc.pages.reduce(
        (acc: number, p) => acc + p.annotations.length,
        0,
      );

      const { error } = await supabase
        .from("papers")
        .update({
          annotations: doc,
          total_pages: doc.total_pages,
          status: "extracted",
        })
        .eq("id", paperId);
      if (error) throw new Error(`save annotations: ${error.message}`);

      toast.success(
        `Extracted ${totalAnnotations} annotation${totalAnnotations === 1 ? "" : "s"} across ${doc.total_pages} page${doc.total_pages === 1 ? "" : "s"}`,
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Extraction failed: ${message}`);
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
    <Button onClick={run} disabled={busy}>
      {busy ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Extracting…
        </>
      ) : (
        <>{alreadyExtracted ? "Re-extract annotations" : "Extract annotations"}</>
      )}
    </Button>
  );
}

// Re-export to keep imports tidy if someone wants the loose type.
export type { Annotation };
