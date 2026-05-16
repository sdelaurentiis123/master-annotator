"use client";

import { useCallback, useMemo, useState } from "react";
import { PdfViewer } from "@/components/pdf-viewer";
import { CommentSidebar } from "@/components/comment-sidebar";
import { ExtractButton } from "@/components/extract-button";
import { PlanButton } from "@/components/plan-button";
import { PlanReview } from "@/components/plan-review";
import { AcceptActions } from "@/components/accept-actions";
import type { DocumentAnnotations, Paper, Plan } from "@/lib/types";

export function PaperWorkspace({
  paper,
  pdfUrl,
}: {
  paper: Paper;
  pdfUrl: string | null;
}) {
  const [page, setPage] = useState(1);
  const [highlightAid, setHighlightAid] = useState<string | null>(null);

  const annotations = (paper.annotations as DocumentAnnotations | null) ?? null;
  const plan = (paper.plan as Plan | null) ?? null;

  const flatAnnotations = useMemo(
    () => annotations?.pages.flatMap((p) => p.annotations) ?? [],
    [annotations],
  );

  const jumpToAnnotation = useCallback((aid: string, targetPage: number) => {
    setPage(targetPage);
    setHighlightAid(aid);
    setTimeout(() => setHighlightAid(null), 1800);
  }, []);

  const handleSidebarPageJump = useCallback((targetPage: number, aid?: string) => {
    setPage(targetPage);
    if (aid) {
      setHighlightAid(aid);
      setTimeout(() => setHighlightAid(null), 1800);
    }
  }, []);

  const handleOverlayClick = useCallback((aid: string) => {
    setHighlightAid(aid);
    setTimeout(() => setHighlightAid(null), 1800);
  }, []);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_400px]">
      <section className="min-w-0">
        {pdfUrl ? (
          <PdfViewer
            url={pdfUrl}
            page={page}
            onPageChange={setPage}
            annotations={flatAnnotations}
            highlightId={highlightAid}
            onAnnotationClick={handleOverlayClick}
          />
        ) : (
          <p className="text-sm text-destructive">
            Could not generate signed URL for the PDF.
          </p>
        )}
      </section>

      <aside className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {pdfUrl && (
            <ExtractButton
              paperId={paper.id}
              pdfUrl={pdfUrl}
              pdfFilename={paper.pdf_filename}
              alreadyExtracted={!!annotations}
            />
          )}
          {annotations && (
            <PlanButton paperId={paper.id} doc={annotations} alreadyPlanned={!!plan} />
          )}
        </div>

        {!annotations && (
          <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Click <strong>Extract annotations</strong> to run Gemini over every page. Takes
            roughly 60–180s for a 12-page paper.
          </div>
        )}

        {plan && (
          <>
            <PlanReview plan={plan} />
            <AcceptActions
              paperId={paper.id}
              pdfFilename={paper.pdf_filename}
              plan={plan}
              status={paper.status}
            />
          </>
        )}

        {annotations && (
          <CommentSidebar
            doc={annotations}
            paperId={paper.id}
            currentPage={page}
            onPageJump={handleSidebarPageJump}
            highlightId={highlightAid}
          />
        )}
      </aside>
    </div>
  );
}
