"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PdfViewer } from "@/components/pdf-viewer";
import { CommentSidebar } from "@/components/comment-sidebar";
import { ExtractButton } from "@/components/extract-button";
import { ExtractProgress } from "@/components/extract-progress";
import { PlanButton } from "@/components/plan-button";
import { PlanReview } from "@/components/plan-review";
import { PathChooser } from "@/components/path-chooser";
import { WorkspaceTabs, type Phase } from "@/components/workspace-tabs";
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

  // Tab/phase state. Prerequisites:
  //   extract: always reachable
  //   plan:    reachable once annotations exist
  //   apply:   reachable once a plan exists
  const reached = useMemo(() => {
    const s = new Set<Phase>(["extract"]);
    if (annotations) s.add("plan");
    if (plan) s.add("apply");
    return s;
  }, [annotations, plan]);

  // Auto-advance to the most-progressed phase when paper data changes
  // (e.g. after extraction completes, jump to Plan).
  const initialPhase: Phase = plan ? "apply" : annotations ? "plan" : "extract";
  const [phase, setPhase] = useState<Phase>(initialPhase);
  useEffect(() => {
    setPhase((cur) => {
      // Only auto-advance forward; never override a user click backwards.
      const order: Phase[] = ["extract", "plan", "apply"];
      const desired: Phase = plan ? "apply" : annotations ? "plan" : "extract";
      return order.indexOf(desired) > order.indexOf(cur) ? desired : cur;
    });
  }, [annotations, plan]);

  const flatAnnotations = useMemo(
    () => annotations?.pages.flatMap((p) => p.annotations) ?? [],
    [annotations],
  );

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
    <div className="space-y-6">
      {/* Phase ribbon */}
      <WorkspaceTabs current={phase} reached={reached} onChange={setPhase} />

      {/* Top: PDF + per-phase right column */}
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
          {phase === "extract" && (
            <ExtractPhase
              paper={paper}
              pdfUrl={pdfUrl}
              annotations={annotations}
              page={page}
              highlightAid={highlightAid}
              onPageJump={handleSidebarPageJump}
            />
          )}
          {phase === "plan" && annotations && (
            <PlanPhase paper={paper} annotations={annotations} plan={plan} />
          )}
          {phase === "apply" && plan && (
            <ApplyPhase paper={paper} plan={plan} />
          )}
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Phase 1: Extract — show extract button + the comment sidebar              */
/* -------------------------------------------------------------------------- */
function ExtractPhase({
  paper,
  pdfUrl,
  annotations,
  page,
  highlightAid,
  onPageJump,
}: {
  paper: Paper;
  pdfUrl: string | null;
  annotations: DocumentAnnotations | null;
  page: number;
  highlightAid: string | null;
  onPageJump: (page: number, aid?: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="kicker">step 1 -- extract reviewer marks</p>
        {pdfUrl && (
          <ExtractButton
            paperId={paper.id}
            pdfUrl={pdfUrl}
            pdfFilename={paper.pdf_filename}
            alreadyExtracted={!!annotations}
          />
        )}
      </div>

      <ExtractProgress paperId={paper.id} active={paper.status === "extracting"} />

      {!annotations ? (
        paper.status !== "extracting" && (
          <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
            Click <strong>Extract annotations</strong> to run Gemini over every page.
            Takes roughly 60--180s for a 12-page paper.
          </div>
        )
      ) : (
        <CommentSidebar
          doc={annotations}
          paperId={paper.id}
          currentPage={page}
          onPageJump={onPageJump}
          highlightId={highlightAid}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Phase 2: Plan — show plan button + accordion of generated prompt          */
/* -------------------------------------------------------------------------- */
function PlanPhase({
  paper,
  annotations,
  plan,
}: {
  paper: Paper;
  annotations: DocumentAnnotations;
  plan: Plan | null;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="kicker">step 2 -- organize edits into a plan</p>
        <PlanButton paperId={paper.id} doc={annotations} alreadyPlanned={!!plan} />
      </div>

      {!plan ? (
        <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          Click <strong>Generate plan</strong> to hand the extracted annotations to
          Claude, which writes a paste-ready Claude Code prompt addressing every edit.
        </div>
      ) : (
        <PlanReview plan={plan} />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Phase 3: Apply — Option A (copy prompt) vs Option B (agent + PR)          */
/* -------------------------------------------------------------------------- */
function ApplyPhase({ paper, plan }: { paper: Paper; plan: Plan }) {
  return (
    <>
      <p className="kicker">step 3 -- apply the plan</p>
      <PathChooser paper={paper} plan={plan} />
    </>
  );
}
