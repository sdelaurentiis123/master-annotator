"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Use the CDN copy of the worker so we don't need to copy it into /public.
// `pdfjs.version` matches whatever react-pdf bundles internally.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export function PdfViewer({
  url,
  page: controlledPage,
  onPageChange,
}: {
  url: string;
  page?: number;
  onPageChange?: (page: number) => void;
}) {
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {numPages ? (
            <span>
              Page <strong className="text-foreground">{pageNum}</strong> of {numPages}
            </span>
          ) : (
            <span>Loading…</span>
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
          <Page
            pageNumber={pageNum}
            width={Math.max(320, containerWidth - 24)}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={
              <div className="flex h-[600px] items-center justify-center text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
              </div>
            }
          />
        </Document>
      </div>
    </div>
  );
}
