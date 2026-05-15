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
      <p className="text-sm text-destructive">
        Supabase: <code>{error.message}</code>. Did you run the SQL in the README?
      </p>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No papers yet. Drop a PDF above to get started.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {data.map((p: Pick<Paper, "id" | "pdf_filename" | "status" | "created_at" | "total_pages">) => (
        <li key={p.id}>
          <Link
            href={`/paper/${p.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.pdf_filename}</p>
              <p className="text-xs text-muted-foreground">
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
