import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { PaperWorkspace } from "@/components/paper-workspace";
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
    .createSignedUrl(paper.pdf_path, 60 * 60); // 1h
  const pdfUrl = signedUrl?.signedUrl ?? null;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" />
            Papers
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight truncate max-w-[60ch]">
              {paper.pdf_filename}
            </h1>
            <p className="text-xs text-muted-foreground font-mono">{paper.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={paper.status} />
          {paper.total_pages > 0 && (
            <Badge variant="outline">{paper.total_pages} pages</Badge>
          )}
        </div>
      </header>

      {paper.error_message && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <strong>Error:</strong> {paper.error_message}
        </div>
      )}

      <PaperWorkspace paper={paper as Paper} pdfUrl={pdfUrl} />
    </main>
  );
}
