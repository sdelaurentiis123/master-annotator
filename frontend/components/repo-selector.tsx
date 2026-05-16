"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

type Repo = {
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  updated_at: string;
};

export function RepoSelector({
  paperId,
  currentRepo,
  onSelected,
}: {
  paperId: string;
  currentRepo: string | null;
  onSelected?: (repo: string) => void;
}) {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [savingRepo, setSavingRepo] = useState<string | null>(null);

  async function fetchRepos() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.provider_token;
      if (!token) {
        throw new Error(
          "No GitHub token on session. Sign out and sign back in to refresh repo access.",
        );
      }
      // Pull up to 100 most-recently-updated repos. Good enough for v1.
      const res = await fetch(
        "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
      );
      if (!res.ok) {
        throw new Error(`GitHub ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);
      }
      const list: Repo[] = await res.json();
      setRepos(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!repos) return [];
    if (!query.trim()) return repos;
    const q = query.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [repos, query]);

  async function pick(repo: Repo) {
    setSavingRepo(repo.full_name);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("papers")
        .update({ connected_repo_full_name: repo.full_name })
        .eq("id", paperId);
      if (error) throw new Error(error.message);
      toast.success(`Connected to ${repo.full_name}`);
      onSelected?.(repo.full_name);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingRepo(null);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-[var(--rule)] bg-[var(--paper-2)] p-3">
      <div className="flex items-center gap-2">
        <p className="kicker flex-1">Connect a GitHub repo</p>
        <button
          onClick={fetchRepos}
          disabled={loading}
          className="kicker normal-case inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--paper-3)] disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          refresh
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1.5 size-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your repos…"
          className="w-full rounded border border-[var(--rule)] bg-card pl-7 pr-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--clay)]/30"
        />
      </div>

      {error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" /> loading your repos…
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No repos match.</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto rounded border border-[var(--rule)] bg-card divide-y divide-[var(--rule)]">
          {filtered.map((r) => {
            const selected = r.full_name === currentRepo;
            const saving = savingRepo === r.full_name;
            return (
              <li key={r.full_name}>
                <button
                  onClick={() => pick(r)}
                  disabled={saving}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--paper-3)] disabled:opacity-50",
                    selected && "bg-[var(--paper-3)]",
                  )}
                >
                  {selected ? (
                    <Check className="mt-0.5 size-3.5 text-[var(--clay)]" />
                  ) : saving ? (
                    <Loader2 className="mt-0.5 size-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="mt-0.5 size-3.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm">{r.full_name}</span>
                      {r.private && (
                        <span className="kicker normal-case">private</span>
                      )}
                    </div>
                    {r.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
