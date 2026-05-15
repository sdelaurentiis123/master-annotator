"use client";

import { useEffect, useState } from "react";
import { Copy, Download, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generatePrompt } from "@/lib/api";
import type { DocumentAnnotations, Plan } from "@/lib/types";

export function CopyPromptDialog({
  open,
  onOpenChange,
  doc,
  plan,
  filename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocumentAnnotations;
  plan: Plan;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError(null);
    generatePrompt(doc, plan)
      .then((r) => setPrompt(r.prompt))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, [open, doc, plan]);

  async function copy() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    if (!prompt) return;
    const stem = filename.replace(/\.pdf$/i, "");
    const blob = new Blob([prompt], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stem}.claude-code-prompt.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Claude Code prompt</DialogTitle>
          <DialogDescription>
            Paste this into a Claude Code session running in your paper&rsquo;s repo. It walks
            through every plan step in order and applies the edits.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
          {busy ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Rendering prompt…
            </div>
          ) : error ? (
            <p className="text-destructive">Failed: {error}</p>
          ) : (
            (prompt ?? "")
          )}
        </div>

        <DialogFooter>
          <Button onClick={copy} disabled={!prompt}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy to clipboard"}
          </Button>
          <Button variant="outline" onClick={download} disabled={!prompt}>
            <Download className="size-4" />
            Download .md
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
