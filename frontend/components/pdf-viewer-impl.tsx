"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnotationOverlay, ConnectorLine } from "@/components/annotation-overlay";
import type { Annotation } from "@/lib/types";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Bundled worker (copied via postinstall) — dodges CDN version mismatch.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type PdfViewerProps = {
  url: string;
  page?: number;
  onPageChange?: (page: number) => void;
  annotations?: Annotation[];
  highlightId?: string | null;
  onAnnotationClick?: (annotationId: string) => void;
};

function PdfViewerImpl({
  url,
  page: controlledPage,
  onPageChange,
  annotations,
  highlightId,
  onAnnotationClick,
}: PdfViewerProps) {
  const [internalPage, setInternalPage] = useState(1);
  const pageNum = controlledPage ?? internalPage;
  const setPageNum = (n: number) => {
    if (onPageChange) onPageChange(n);
    else setInternalPage(n);
  };
  const [numPages, setNumPages] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  useEffect(() => {
    const update = () => {
      const el = document.getElementById("pdf-viewport");
      if (el) setContainerWidth(el.clientWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Only render overlays for annotations on the current page
  const currentPageAnnotations = (annotations ?? []).filter(
    (a) => a.page === pageNum,
  );

  const pageWidth = Math.max(320, containerWidth - 24);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {numPages ? (
            <span>
              Page <strong className="text-foreground">{pageNum}</strong> of {numPages}
            </span>
          ) : (
            <span>Loading…</span>
          )}
          {currentPageAnnotations.length > 0 && (
            <span className="kicker">
              {currentPageAnnotations.length} annotation
              {currentPageAnnotations.length === 1 ? "" : "s"} on this page
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            disabled={pageNum <= 1}
            onClick={() => setPageNum(Math.max(1, pageNum - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={!numPages || pageNum >= numPages}
            onClick={() => setPageNum(Math.min(numPages ?? pageNum, pageNum + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div id="pdf-viewport" className="rounded-lg border bg-card p-2 shadow-sm">
        <Document
          file={url}
          onLoadSuccess={(d) => setNumPages(d.numPages)}
          onLoadError={(e) => console.error("pdf load error", e)}
          loading={
            <div className="flex h-[600px] items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          }
        >
          <div className="relative inline-block">
            <Page
              pageNumber={pageNum}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={
                <div className="flex h-[600px] items-center justify-center text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              }
            />
            {/* SVG connector layer — drawn between bbox center and anchor_bbox center */}
            {currentPageAnnotations.length > 0 && (
              <svg
                className="pointer-events-none absolute inset-0 size-full"
                style={{ zIndex: 7 }}
                preserveAspectRatio="none"
              >
                {currentPageAnnotations.map((a) => (
                  <ConnectorLine key={`${a.id}-line`} annotation={a} />
                ))}
              </svg>
            )}
            {/* Box overlays (mark + anchor) */}
            {currentPageAnnotations.map((a) => (
              <AnnotationOverlay
                key={a.id}
                annotation={a}
                highlighted={highlightId === a.id}
                onClick={() => onAnnotationClick?.(a.id)}
              />
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}

export default PdfViewerImpl;
