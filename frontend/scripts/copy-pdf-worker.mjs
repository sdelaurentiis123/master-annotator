#!/usr/bin/env node
/**
 * Copy the pdfjs-dist worker into public/ so react-pdf can fetch it from
 * the same origin (cdnjs sometimes lags behind the version react-pdf bundles).
 * Runs as a postinstall step.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "../public/pdf.worker.min.mjs");

try {
  const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(workerPath, dest);
  console.log(`[copy-pdf-worker] ${workerPath} → ${dest}`);
} catch (err) {
  console.warn(
    `[copy-pdf-worker] could not resolve pdfjs-dist/build/pdf.worker.min.mjs: ${err?.message ?? err}`,
  );
  console.warn("[copy-pdf-worker] If the PDF viewer breaks, copy the file manually.");
}
