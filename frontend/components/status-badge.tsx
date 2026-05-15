import { Badge } from "@/components/ui/badge";
import type { PaperStatus } from "@/lib/types";

const styles: Record<PaperStatus, string> = {
  uploaded: "bg-zinc-100 text-zinc-700 border-zinc-200",
  extracting: "bg-amber-50 text-amber-800 border-amber-200",
  extracted: "bg-sky-50 text-sky-800 border-sky-200",
  planning: "bg-violet-50 text-violet-800 border-violet-200",
  planned: "bg-indigo-50 text-indigo-800 border-indigo-200",
  accepted: "bg-emerald-50 text-emerald-800 border-emerald-200",
  executing: "bg-amber-50 text-amber-800 border-amber-200",
  complete: "bg-emerald-50 text-emerald-800 border-emerald-200",
  failed: "bg-red-50 text-red-800 border-red-200",
};

const labels: Record<PaperStatus, string> = {
  uploaded: "uploaded",
  extracting: "extracting…",
  extracted: "extracted",
  planning: "planning…",
  planned: "planned",
  accepted: "accepted",
  executing: "executing…",
  complete: "complete",
  failed: "failed",
};

export function StatusBadge({ status }: { status: PaperStatus | string }) {
  const cls = styles[status as PaperStatus] ?? "bg-zinc-100 text-zinc-600 border-zinc-200";
  const text = labels[status as PaperStatus] ?? status;
  return (
    <Badge variant="outline" className={cls}>
      {text}
    </Badge>
  );
}
