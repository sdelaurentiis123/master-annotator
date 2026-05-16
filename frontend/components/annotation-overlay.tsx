"use client";

import type { Annotation, AnnotationType } from "@/lib/types";

const TYPE_COLORS: Record<AnnotationType, string> = {
  delete: "#dc2626",
  insert: "#059669",
  replace: "#d97706",
  comment: "#2563eb",
  question: "#7c3aed",
  emphasize: "#ca8a04",
  flag: "#475569",
};

// bbox is normalized 0-1000; divide by 10 → percentage of the page container.
const pct = (v: number) => `${(v / 10).toFixed(3)}%`;

export function colorFor(a: Annotation): string {
  return TYPE_COLORS[a.type] ?? "#475569";
}

/** One annotation: an anchor box (dashed), a mark box (solid), and an optional
 * connector line between them when the writing is far from the printed target. */
export function AnnotationOverlay({
  annotation: a,
  highlighted,
  onClick,
}: {
  annotation: Annotation;
  highlighted?: boolean;
  onClick?: () => void;
}) {
  const color = colorFor(a);
  const hasMark = Array.isArray(a.bbox) && a.bbox.length === 4;
  const hasAnchor = Array.isArray(a.anchor_bbox) && a.anchor_bbox.length === 4;

  return (
    <>
      {hasAnchor && (
        <div
          style={{
            position: "absolute",
            left: pct(a.anchor_bbox[0]),
            top: pct(a.anchor_bbox[1]),
            width: pct(Math.max(1, a.anchor_bbox[2] - a.anchor_bbox[0])),
            height: pct(Math.max(1, a.anchor_bbox[3] - a.anchor_bbox[1])),
            border: `1.5px dashed ${color}`,
            borderRadius: 2,
            pointerEvents: "none",
            zIndex: 5,
            opacity: 0.85,
          }}
        />
      )}
      {hasMark && (
        <button
          onClick={onClick}
          title={a.intent}
          aria-label={a.intent}
          style={{
            position: "absolute",
            left: pct(a.bbox[0]),
            top: pct(a.bbox[1]),
            width: pct(Math.max(1, a.bbox[2] - a.bbox[0])),
            height: pct(Math.max(1, a.bbox[3] - a.bbox[1])),
            border: `2px solid ${color}`,
            background: `color-mix(in srgb, ${color} 18%, transparent)`,
            borderRadius: 2,
            cursor: "pointer",
            zIndex: 10,
            padding: 0,
            transition: "filter .15s, box-shadow .15s",
            boxShadow: highlighted ? `0 0 0 4px ${color}` : "none",
          }}
        />
      )}
    </>
  );
}

/** A single connector line. Drawn separately so all lines stack into one SVG. */
export function ConnectorLine({
  annotation: a,
}: {
  annotation: Annotation;
}) {
  if (!Array.isArray(a.bbox) || a.bbox.length !== 4) return null;
  if (!Array.isArray(a.anchor_bbox) || a.anchor_bbox.length !== 4) return null;

  const mx = (a.bbox[0] + a.bbox[2]) / 2;
  const my = (a.bbox[1] + a.bbox[3]) / 2;
  const ax = (a.anchor_bbox[0] + a.anchor_bbox[2]) / 2;
  const ay = (a.anchor_bbox[1] + a.anchor_bbox[3]) / 2;
  // Skip if mark and anchor essentially overlap
  if (Math.abs(mx - ax) + Math.abs(my - ay) < 25) return null;

  const color = colorFor(a);
  return (
    <line
      x1={pct(mx)}
      y1={pct(my)}
      x2={pct(ax)}
      y2={pct(ay)}
      stroke={color}
      strokeWidth={1.6}
      strokeDasharray="5 4"
      opacity={0.55}
    />
  );
}
