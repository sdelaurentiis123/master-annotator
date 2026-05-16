import Link from "next/link";
import { cookies } from "next/headers";
import { formatDistanceToNowStrict } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { createClient } from "@/utils/supabase/server";
import type { Paper } from "@/lib/types";

export async function PapersList() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("papers")
    .select("id, pdf_filename, status, created_at, total_pages")
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
        No papers yet — drop a PDF above.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--rule)] rounded-md border border-[var(--rule)] bg-[var(--paper-2)]">
      {data.map((p: Pick<Paper, "id" | "pdf_filename" | "status" | "created_at" | "total_pages">) => (
        <li key={p.id}>
          <Link
            href={`/paper/${p.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[var(--paper-3)]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-base">{p.pdf_filename}</p>
              <p className="kicker mt-0.5">
                {formatDistanceToNowStrict(p.created_at)} ago
                {p.total_pages > 0 ? ` · ${p.total_pages} pages` : ""}
              </p>
            </div>
            <StatusBadge status={p.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
