import { Badge } from "@/components/ui/badge";
import type { ReviewerIntent } from "@/lib/types";

const styles: Record<ReviewerIntent, { cls: string; label: string }> = {
  insert: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", label: "Insert" },
  delete: { cls: "bg-red-50 text-red-800 border-red-200", label: "Delete" },
  update: { cls: "bg-amber-50 text-amber-800 border-amber-200", label: "Update" },
  methodological_error: {
    cls: "bg-rose-100 text-rose-900 border-rose-300",
    label: "Method err",
  },
  question: { cls: "bg-sky-50 text-sky-800 border-sky-200", label: "Question" },
  confusion: { cls: "bg-violet-50 text-violet-800 border-violet-200", label: "Confusion" },
  critique: { cls: "bg-pink-50 text-pink-800 border-pink-200", label: "Critique" },
};

export function IntentBadge({ intent }: { intent: ReviewerIntent }) {
  const s = styles[intent];
  return (
    <Badge variant="outline" className={s.cls}>
      {s.label}
    </Badge>
  );
}
