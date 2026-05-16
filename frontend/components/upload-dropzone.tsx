"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

const ACCEPT = "application/pdf";
const MAX_BYTES = 50 * 1024 * 1024;

export function UploadDropzone({ userId }: { userId: string }) {
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
        // Scope storage path under the user's uid so RLS can enforce ownership.
        const pdfPath = `${userId}/${paperId}.pdf`;

        const { error: upErr } = await supabase.storage
          .from("papers")
          .upload(pdfPath, file, { contentType: "application/pdf", upsert: false });
        if (upErr) throw new Error(`storage upload: ${upErr.message}`);

        const { error: insErr } = await supabase.from("papers").insert({
          id: paperId,
          user_id: userId,
          pdf_filename: file.name,
          total_pages: 0,
          pdf_path: pdfPath,
          status: "uploaded",
        });
        if (insErr) {
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
        "relative flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--rule)] bg-[var(--paper-2)] px-6 py-16 text-center transition-colors",
        dragging && "border-[var(--clay)] bg-[var(--clay)]/5",
        busy && "pointer-events-none opacity-70",
      )}
    >
      {busy ? (
        <Loader2 className="size-7 animate-spin text-[var(--ink-3)]" />
      ) : (
        <Upload className="size-7 text-[var(--ink-3)]" />
      )}
      <div className="space-y-1">
        <p className="font-serif text-base">
          {busy ? "Uploading…" : "Drop a marked-up PDF here"}
        </p>
        <p className="kicker">or click to choose · PDF up to 50 MB</p>
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
