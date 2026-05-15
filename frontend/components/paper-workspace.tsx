"use client";

import { useState } from "react";
import { PdfViewer } from "@/components/pdf-viewer";
import { CommentSidebar } from "@/components/comment-sidebar";
import { ExtractButton } from "@/components/extract-button";
import type { DocumentAnnotations, Paper } from "@/lib/types";

export function PaperWorkspace({
  paper,
  pdfUrl,
}: {
  paper: Paper;
  pdfUrl: string | null;
}) {
  const [page, setPage] = useState(1);

  const annotations = (paper.annotations as DocumentAnnotations | null) ?? null;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_380px]">
      <section className="min-w-0">
        {pdfUrl ? (
          <PdfViewer url={pdfUrl} page={page} onPageChange={setPage} />
        ) : (
          <p className="text-sm text-destructive">
            Could not generate signed URL for the PDF.
          </p>
        )}
      </section>

      <aside className="space-y-4">
        <div className="flex items-center gap-2">
          {pdfUrl && (
            <ExtractButton
              paperId={paper.id}
              pdfUrl={pdfUrl}
              pdfFilename={paper.pdf_filename}
              alreadyExtracted={!!annotations}
            />
          )}
        </div>

        {annotations ? (
          <CommentSidebar doc={annotations} onPageJump={setPage} />
        ) : (
          <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Click <strong>Extract annotations</strong> to run Gemini over every page. Takes
            roughly 60–90s for a 12-page paper.
          </div>
        )}
      </aside>
    </div>
  );
}
