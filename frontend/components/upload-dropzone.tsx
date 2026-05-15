"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

const ACCEPT = "application/pdf";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export function UploadDropzone() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;
      if (file.type !== ACCEPT) {
        toast.error("Only PDF files are supported.");
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB).`);
        return;
      }
      setBusy(true);
      try {
        const supabase = createClient();
        const paperId = crypto.randomUUID();
        const pdfPath = `${paperId}.pdf`;

        // 1. Upload bytes to Storage
        const { error: upErr } = await supabase.storage
          .from("papers")
          .upload(pdfPath, file, { contentType: "application/pdf", upsert: false });
        if (upErr) throw new Error(`storage upload: ${upErr.message}`);

        // 2. Insert metadata row
        const { error: insErr } = await supabase.from("papers").insert({
          id: paperId,
          pdf_filename: file.name,
          total_pages: 0, // updated after extraction
          pdf_path: pdfPath,
          status: "uploaded",
        });
        if (insErr) {
          // Clean up the orphaned blob to keep storage tidy
          await supabase.storage.from("papers").remove([pdfPath]).catch(() => {});
          throw new Error(`db insert: ${insErr.message}`);
        }

        toast.success(`Uploaded ${file.name}`);
        router.push(`/paper/${paperId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        toast.error(message);
        setBusy(false);
      }
    },
    [router],
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (busy) return;
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card px-6 py-14 text-center transition-colors",
        dragging && "border-primary bg-primary/5",
        busy && "pointer-events-none opacity-70",
      )}
    >
      {busy ? (
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      ) : (
        <Upload className="size-8 text-muted-foreground" />
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {busy ? "Uploading…" : "Drop a marked-up PDF here"}
        </p>
        <p className="text-xs text-muted-foreground">or click to choose a file · PDF up to 50 MB</p>
      </div>
      <input
        type="file"
        accept={ACCEPT}
        disabled={busy}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
