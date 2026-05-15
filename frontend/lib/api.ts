/**
 * Typed fetch wrapper for the FastAPI backend.
 *
 * Frontend talks to the backend ONLY for processing (extract / plan / prompt).
 * All persistence goes through Supabase.
 */
import type { DocumentAnnotations, Plan, PlanResponse } from "./types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export class BackendError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`backend ${status}: ${body.slice(0, 240)}`);
    this.status = status;
    this.body = body;
  }
}

async function fetchJson<T>(path: string, init: RequestInit): Promise<T> {
  const resp = await fetch(`${BACKEND_URL}${path}`, init);
  if (!resp.ok) {
    const text = await resp.text();
    throw new BackendError(resp.status, text);
  }
  return (await resp.json()) as T;
}

export async function backendHealth(): Promise<{
  ok: boolean;
  gemini_key: boolean;
  anthropic_key: boolean;
  gemini_model: string;
  claude_model: string;
}> {
  return fetchJson("/api/health", { method: "GET" });
}

export async function extractAnnotations(
  pdfBlob: Blob,
  filename: string,
): Promise<DocumentAnnotations> {
  const fd = new FormData();
  fd.append("file", pdfBlob, filename);
  return fetchJson("/api/extract", { method: "POST", body: fd });
}

export async function generatePlan(
  doc: DocumentAnnotations,
): Promise<PlanResponse> {
  return fetchJson("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ document: doc }),
  });
}

export async function generatePrompt(
  doc: DocumentAnnotations,
  plan: Plan,
): Promise<{ prompt: string }> {
  return fetchJson("/api/prompt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ document: doc, plan }),
  });
}
