import type { AnnotationType } from "@/lib/types";

/** Visuals MUST match annotation-overlay.tsx::TYPE_COLORS so the PDF box and
 * the sidebar card for the same annotation read as the same thing. */
const styles: Record<AnnotationType, { cls: string; label: string }> = {
  delete: { cls: "bg-red-50 text-red-800 border-red-200", label: "delete" },
  insert: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "insert" },
  replace: { cls: "bg-amber-50 text-amber-800 border-amber-200", label: "replace" },
  comment: { cls: "bg-blue-50 text-blue-800 border-blue-200", label: "comment" },
  question: { cls: "bg-violet-50 text-violet-800 border-violet-200", label: "question" },
  emphasize: { cls: "bg-yellow-50 text-yellow-800 border-yellow-200", label: "emphasize" },
  flag: { cls: "bg-slate-100 text-slate-700 border-slate-200", label: "flag" },
};

export function TypeBadge({ type }: { type: AnnotationType }) {
  const s = styles[type] ?? { cls: "bg-zinc-100 text-zinc-700 border-zinc-200", label: type };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide font-mono ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
