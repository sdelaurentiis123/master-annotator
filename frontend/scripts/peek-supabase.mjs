#!/usr/bin/env node
/**
 * One-shot: dump every paper row's high-level state.
 * Run: node scripts/peek-supabase.mjs [paperId]
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ?? "https://nhuqwskvumbznrukhtcg.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable_rmh4wsVZIcOySRVHBmZwaA_H_plwdJu";

const supabase = createClient(URL, KEY);
const id = process.argv[2];

const q = supabase
  .from("papers")
  .select("id, created_at, pdf_filename, status, total_pages, annotations, plan, error_message")
  .order("created_at", { ascending: false })
  .limit(10);
if (id) q.eq("id", id);

const { data, error } = await q;
if (error) {
  console.error("supabase error:", error);
  process.exit(1);
}

for (const p of data) {
  const ann = p.annotations;
  const annCount = ann?.pages?.reduce?.((s, pg) => s + (pg.annotations?.length ?? 0), 0) ?? 0;
  const failedPages = ann?.pages?.filter?.((pg) => (pg.annotations?.length ?? 0) === 0).length ?? 0;
  const plan = p.plan;
  const stepCount = plan?.steps?.length ?? 0;
  const classifiedCount = ann?.pages?.flatMap?.((pg) => pg.annotations ?? []).filter?.((a) => a.reviewer_intent).length ?? 0;
  const userEditedCount = ann?.pages?.flatMap?.((pg) => pg.annotations ?? []).filter?.((a) => a.user_edited).length ?? 0;

  console.log(`\n── ${p.pdf_filename} ─────────────────────────`);
  console.log(`id:           ${p.id}`);
  console.log(`created:      ${p.created_at}`);
  console.log(`status:       ${p.status}`);
  console.log(`pages:        ${p.total_pages}`);
  console.log(`annotations:  ${annCount}${failedPages ? ` (${failedPages} empty pages)` : ""}`);
  console.log(`classified:   ${classifiedCount} / ${annCount}${classifiedCount === annCount && annCount > 0 ? " ✓" : ""}`);
  console.log(`user-edited:  ${userEditedCount}`);
  console.log(`plan:         ${plan ? `${stepCount} steps · "${plan.summary?.slice(0, 80)}…"` : "—"}`);
  if (p.error_message) console.log(`ERROR:        ${p.error_message}`);
}
console.log("");
