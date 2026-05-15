/**
 * TypeScript mirror of the backend Pydantic schemas in
 * `backend/app/extractor/schema.py` and the planner output.
 * Keep these in sync by hand for Phase 1 — they're small.
 */

export type AnnotationShape =
  | "strikethrough"
  | "scribble"
  | "caret"
  | "circle"
  | "underline"
  | "highlight"
  | "bracket"
  | "arrow"
  | "handwriting"
  | "dot";

export type AnnotationType =
  | "delete"
  | "insert"
  | "replace"
  | "comment"
  | "question"
  | "emphasize"
  | "flag";

export type ReviewerIntent =
  | "insert"
  | "delete"
  | "update"
  | "methodological_error"
  | "question"
  | "confusion"
  | "critique";

export interface Annotation {
  id: string;
  page: number;
  shape: AnnotationShape;
  type: AnnotationType;
  bbox: [number, number, number, number] | number[];
  anchor_bbox: number[];
  anchor_text: string;
  context_text: string;
  annotation_content: string;
  intent: string;
  has_arrow: boolean;
  confidence: number;
  reviewer_intent: ReviewerIntent | null;
  user_edited: boolean;
}

export interface PageAnnotations {
  page_number: number;
  width_px: number;
  height_px: number;
  annotations: Annotation[];
}

export interface DocumentAnnotations {
  source_filename: string;
  total_pages: number;
  pages: PageAnnotations[];
}

export type PlanStepKind = "commit" | "pr_comment" | "manual";

export interface PlanStep {
  id: string;
  order: number;
  kind: PlanStepKind;
  title: string;
  description: string;
  source_annotation_ids: string[];
  target_files_hint: string[] | null;
  requires_human_confirmation: boolean;
  rationale: string;
}

export interface Plan {
  summary: string;
  steps: PlanStep[];
  unactionable_count: number;
}

export interface Classification {
  annotation_id: string;
  reviewer_intent: ReviewerIntent;
  reasoning: string;
}

export interface PlanResponse {
  classifications: Classification[];
  plan: Plan;
}

export type PaperStatus =
  | "uploaded"
  | "extracting"
  | "extracted"
  | "planning"
  | "planned"
  | "accepted"
  | "executing"
  | "complete"
  | "failed";

export interface Paper {
  id: string;
  created_at: string;
  pdf_filename: string;
  total_pages: number;
  pdf_path: string;
  status: PaperStatus;
  annotations: DocumentAnnotations | null;
  plan: Plan | null;
  error_message: string | null;
}
