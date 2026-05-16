import Link from "next/link";
import { cookies } from "next/headers";
import { formatDistanceToNowStrict } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { DeletePaperButton } from "@/components/delete-paper-button";
import { createClient } from "@/utils/supabase/server";
import type { Paper } from "@/lib/types";

export async function PapersList() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("papers")
    .select("id, pdf_filename, status, created_at, total_pages, pdf_path")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return (
      <div className="rounded-md border border-[var(--rule)] bg-[var(--paper-2)] px-4 py-3 text-sm">
        <p className="text-[var(--danger)]">
          Couldn&rsquo;t reach Supabase: <code className="mono">{error.message}</code>
        </p>
        <p className="kicker mt-1">
          Did you run <code className="mono normal-case">supabase/schema.sql</code>?
        </p>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-[var(--ink-3)] italic">
        No papers yet -- drop a PDF above.
      </p>
    );
  }

  type Row = Pick<
    Paper,
    "id" | "pdf_filename" | "status" | "created_at" | "total_pages" | "pdf_path"
  >;

  return (
    <ul className="divide-y divide-[var(--rule)] rounded-md border border-[var(--rule)] bg-[var(--paper-2)]">
      {data.map((p: Row) => (
        <li key={p.id} className="group flex items-center hover:bg-[var(--paper-3)] transition-colors">
          <Link
            href={`/paper/${p.id}`}
            className="flex flex-1 items-center justify-between gap-4 px-4 py-3 min-w-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-base">{p.pdf_filename}</p>
              <p className="kicker mt-0.5">
                {formatDistanceToNowStrict(p.created_at)} ago
                {p.total_pages > 0 ? ` -- ${p.total_pages} pages` : ""}
              </p>
            </div>
            <StatusBadge status={p.status} />
          </Link>
          <div className="px-3 py-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <DeletePaperButton
              paperId={p.id}
              pdfPath={p.pdf_path}
              filename={p.pdf_filename}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
