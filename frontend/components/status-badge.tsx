import type { PaperStatus } from "@/lib/types";

const dotColor: Record<PaperStatus, string> = {
  uploaded: "var(--ink-3)",
  extracting: "var(--seat-update)",
  extracted: "var(--seat-question)",
  planning: "var(--seat-confuse)",
  planned: "var(--seat-update)",
  accepted: "var(--seat-insert)",
  executing: "var(--seat-update)",
  complete: "var(--seat-insert)",
  failed: "var(--danger)",
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
  const c = dotColor[status as PaperStatus] ?? "var(--ink-3)";
  const text = labels[status as PaperStatus] ?? status;
  const pulsing = status.endsWith("…") || status === "extracting" || status === "planning" || status === "executing";
  return (
    <span className="inline-flex items-center gap-1.5 kicker">
      <span
        className="size-1.5 rounded-full"
        style={{
          background: c,
          animation: pulsing ? "pulse 1.8s ease-in-out infinite" : undefined,
        }}
      />
      {text}
    </span>
  );
}
