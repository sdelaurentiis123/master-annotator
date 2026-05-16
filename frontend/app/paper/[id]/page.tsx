import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { StatusBadge } from "@/components/status-badge";
import { PaperWorkspace } from "@/components/paper-workspace";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/utils/supabase/server";
import type { Paper } from "@/lib/types";

export default async function PaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: paper, error } = await supabase
    .from("papers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !paper) {
    notFound();
  }

  const { data: signedUrl } = await supabase.storage
    .from("papers")
    .createSignedUrl(paper.pdf_path, 60 * 60);
  const pdfUrl = signedUrl?.signedUrl ?? null;

  return (
    <>
      <SiteHeader
        subtitle="reviewer marginalia → LaTeX PR"
        right={<StatusBadge status={paper.status} />}
      />

      <main className="mx-auto w-full max-w-7xl px-6 py-8 space-y-6">
        <header className="space-y-1">
          <p className="kicker">
            {paper.total_pages > 0 ? `${paper.total_pages} pages` : "—"} ·
            <span className="mono ml-1 normal-case">{paper.id}</span>
          </p>
          <h1 className="font-serif text-2xl font-medium tracking-tight truncate max-w-[60ch]">
            {paper.pdf_filename}
          </h1>
        </header>

        {paper.error_message && (
          <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-4 py-3 text-sm">
            <p className="kicker mb-1 text-[var(--danger)]">error</p>
            <p>{paper.error_message}</p>
          </div>
        )}

        <PaperWorkspace paper={paper as Paper} pdfUrl={pdfUrl} />
      </main>
    </>
  );
}
