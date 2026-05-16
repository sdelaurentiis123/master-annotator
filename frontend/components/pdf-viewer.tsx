"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { PdfViewerProps } from "./pdf-viewer-impl";

export type { PdfViewerProps };

// react-pdf imports pdfjs-dist at module top level, which touches DOMMatrix —
// a browser-only API. ssr:false keeps the module off the server bundle.
// Turbopack is happiest with a plain default-export import, no `.then` chain.
export const PdfViewer = dynamic<PdfViewerProps>(
  () => import("./pdf-viewer-impl"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center rounded-lg border bg-card text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    ),
  },
);
