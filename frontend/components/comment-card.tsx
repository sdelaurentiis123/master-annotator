"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, X, Save, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IntentBadge } from "@/components/intent-badge";
import { TypeBadge } from "@/components/type-badge";
import { colorFor } from "@/components/annotation-overlay";
import { createClient } from "@/utils/supabase/client";
import type {
  Annotation,
  DocumentAnnotations,
  ReviewerIntent,
} from "@/lib/types";

const INTENT_OPTIONS: ReviewerIntent[] = [
  "insert",
  "delete",
  "update",
  "methodological_error",
  "question",
  "confusion",
  "critique",
];

export function CommentCard({
  annotation,
  doc,
  paperId,
  onPageJump,
  highlighted,
}: {
  annotation: Annotation;
  doc: DocumentAnnotations;
  paperId: string;
  onPageJump?: (page: number) => void;
  highlighted?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftIntent, setDraftIntent] = useState(annotation.intent);
  const [draftReviewerIntent, setDraftReviewerIntent] = useState<ReviewerIntent | null>(
    annotation.reviewer_intent,
  );
  const [draftAnchor, setDraftAnchor] = useState(annotation.anchor_text);
  const cardRef = useRef<HTMLDivElement>(null);

  const typeColor = colorFor(annotation);

  // When the matching PDF overlay is clicked, scroll this card into view
  // inside the sidebar's bounded-scroll container.
  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlighted]);

  // Re-seed draft state from the live annotation each time edit mode opens.
  // Without this, useState's initial value freezes on first mount and gets
  // stale when the annotation updates (e.g. after the planner classifies it).
  function openEdit() {
    setDraftIntent(annotation.intent);
    setDraftReviewerIntent(annotation.reviewer_intent);
    setDraftAnchor(annotation.anchor_text);
    setEditing(true);
  }

  async function save() {
    setBusy(true);
    try {
      const updated: DocumentAnnotations = {
        ...doc,
        pages: doc.pages.map((p) =>
          p.page_number === annotation.page
            ? {
                ...p,
                annotations: p.annotations.map((a) =>
                  a.id === annotation.id
                    ? {
                        ...a,
                        intent: draftIntent.trim(),
                        reviewer_intent: draftReviewerIntent,
                        anchor_text: draftAnchor.trim(),
                        user_edited: true,
                      }
                    : a,
                ),
              }
            : p,
        ),
      };

      const supabase = createClient();
      const { error } = await supabase
        .from("papers")
        .update({ annotations: updated, plan: null, status: "extracted" })
        .eq("id", paperId);
      if (error) throw new Error(error.message);

      toast.success("Annotation updated. Plan cleared — regenerate when ready.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Save failed: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete annotation "${annotation.intent.slice(0, 60)}…"?`)) return;
    setBusy(true);
    try {
      const updated: DocumentAnnotations = {
        ...doc,
        pages: doc.pages.map((p) =>
          p.page_number === annotation.page
            ? {
                ...p,
                annotations: p.annotations.filter((a) => a.id !== annotation.id),
              }
            : p,
        ),
      };

      const supabase = createClient();
      const { error } = await supabase
        .from("papers")
        .update({ annotations: updated, plan: null, status: "extracted" })
        .eq("id", paperId);
      if (error) throw new Error(error.message);

      toast.success("Annotation deleted.");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Delete failed: ${message}`);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div
        className="rounded-lg border bg-card p-3 space-y-2 ring-1 ring-foreground/20 border-l-[3px]"
        style={{ borderLeftColor: typeColor }}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted-foreground">
            Reviewer intent
          </span>
          <select
            value={draftReviewerIntent ?? ""}
            onChange={(e) =>
              setDraftReviewerIntent(
                (e.target.value || null) as ReviewerIntent | null,
              )
            }
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            <option value="">— not set —</option>
            {INTENT_OPTIONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Instruction
          </label>
          <Textarea
            value={draftIntent}
            onChange={(e) => setDraftIntent(e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Anchor text (printed text being annotated)
          </label>
          <Textarea
            value={draftAnchor}
            onChange={(e) => setDraftAnchor(e.target.value)}
            rows={1}
            className="text-xs italic"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={save} disabled={busy || !draftIntent.trim()}>
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            <X className="size-3" />
            Cancel
          </Button>
          <span className="ml-auto" />
          <Button
            size="sm"
            variant="destructive"
            onClick={remove}
            disabled={busy}
            title="Delete this annotation"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "group rounded-lg border bg-card p-3 transition-colors border-l-[3px] scroll-mt-2",
        highlighted && "ring-2 ring-offset-1 bg-amber-50",
      )}
      style={{
        borderLeftColor: typeColor,
        ...(highlighted ? { boxShadow: `0 0 0 2px ${typeColor}` } : {}),
      }}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <TypeBadge type={annotation.type} />
        {annotation.reviewer_intent && (
          <IntentBadge intent={annotation.reviewer_intent} />
        )}
        {annotation.user_edited && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            edited
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={openEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-muted text-muted-foreground"
            title="Edit annotation"
          >
            <Pencil className="size-3" />
          </button>
          <button
            onClick={() => onPageJump?.(annotation.page)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            p. {annotation.page} <ChevronRight className="size-3" />
          </button>
        </span>
      </div>

      <button
        onClick={() => onPageJump?.(annotation.page)}
        className="block w-full text-left"
      >
        <p className="text-sm leading-snug">{annotation.intent}</p>
        {annotation.anchor_text && (
          <p className="mt-1 truncate text-xs italic text-muted-foreground">
            &ldquo;{annotation.anchor_text}&rdquo;
          </p>
        )}
        {annotation.annotation_content && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {annotation.annotation_content}
          </p>
        )}
        <div className="mt-2 h-1 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full"
            style={{
              width: `${Math.round(annotation.confidence * 100)}%`,
              background: typeColor,
            }}
          />
        </div>
      </button>
    </div>
  );
}
