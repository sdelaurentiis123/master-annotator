"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, GitPullRequest, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyPromptDialog } from "@/components/copy-prompt-dialog";
import { RepoSelector } from "@/components/repo-selector";
import { AgentProgressModal } from "@/components/agent-progress-modal";
import { createClient } from "@/utils/supabase/client";
import type { Paper, Plan } from "@/lib/types";

export function PathChooser({
  paper,
  plan,
}: {
  paper: Paper;
  plan: Plan;
}) {
  const router = useRouter();
  const [copyOpen, setCopyOpen] = useState(false);
  const [showSelector, setShowSelector] = useState(!paper.connected_repo_full_name);
  const [executing, setExecuting] = useState(false);
  const [agentOpen, setAgentOpen] = useState(paper.status === "executing");

  const accepted =
    paper.status === "accepted" ||
    paper.status === "executing" ||
    paper.status === "complete";

  async function acceptAndCopy() {
    if (!accepted) {
      const supabase = createClient();
      const { error } = await supabase
        .from("papers")
        .update({ status: "accepted" })
        .eq("id", paper.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      router.refresh();
    }
    setCopyOpen(true);
  }

  async function openPr() {
    if (!paper.connected_repo_full_name) {
      setShowSelector(true);
      return;
    }
    setExecuting(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.provider_token;
      if (!token) {
        throw new Error("GitHub token missing on session. Re-sign in.");
      }
      const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8001";
      const resp = await fetch(`${backend}/api/papers/${paper.id}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo_full_name: paper.connected_repo_full_name,
          github_token: token,
          plan_prompt: plan.prompt,
        }),
      });
      if (!resp.ok) {
        throw new Error(`backend ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
      }
      await supabase
        .from("papers")
        .update({ status: "executing", error_message: null })
        .eq("id", paper.id);
      toast.success("Agent dispatched.");
      setAgentOpen(true);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Open PR failed: ${message}`);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <>
      <div className="space-y-3">
        {/* Path A — copy the prompt */}
        <div className="rounded-md border border-[var(--rule)] bg-[var(--paper-2)] p-4 space-y-3">
          <div className="space-y-1">
            <p className="kicker">option a</p>
            <h3 className="font-serif text-base font-medium">Use it yourself</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Copy the generated Claude Code prompt and paste it into a Claude Code
              session in your paper&rsquo;s repo.
            </p>
          </div>
          <Button onClick={acceptAndCopy} className="w-full">
            <Copy className="size-4" />
            {accepted ? "Show prompt" : "Accept plan and copy prompt"}
          </Button>
        </div>

        {/* Path B — agent + PR */}
        <div className="rounded-md border border-[var(--rule)] bg-[var(--paper-2)] p-4 space-y-3">
          <div className="space-y-1">
            <p className="kicker">option b</p>
            <h3 className="font-serif text-base font-medium">Let our agent do it</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              An agent clones your repo in a sandbox, applies the edits, runs a compile
              check, and opens a pull request with the changes.
            </p>
          </div>

          {paper.connected_repo_full_name && !showSelector ? (
            <div className="rounded border border-[var(--rule)] bg-card px-2 py-1.5 text-xs font-mono">
              {paper.connected_repo_full_name}
              <button
                onClick={() => setShowSelector(true)}
                className="kicker normal-case ml-2 text-muted-foreground hover:text-foreground"
              >
                change
              </button>
            </div>
          ) : null}

          {(showSelector || !paper.connected_repo_full_name) && (
            <RepoSelector
              paperId={paper.id}
              currentRepo={paper.connected_repo_full_name}
              onSelected={() => setShowSelector(false)}
            />
          )}

          <Button
            onClick={openPr}
            disabled={!paper.connected_repo_full_name || executing}
            className="w-full"
          >
            {executing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GitPullRequest className="size-4" />
            )}
            Accept plan and open PR
          </Button>
        </div>
      </div>

      <CopyPromptDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        plan={plan}
        filename={paper.pdf_filename}
      />
      <AgentProgressModal
        open={agentOpen}
        onOpenChange={setAgentOpen}
        paperId={paper.id}
      />
    </>
  );
}
