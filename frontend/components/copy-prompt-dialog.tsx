"use client";

import { useState } from "react";
import { Copy, Download, Check } from "lucide-react";
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
import type { Plan } from "@/lib/types";

export function CopyPromptDialog({
  open,
  onOpenChange,
  plan,
  filename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan;
  filename: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(plan.prompt);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const stem = filename.replace(/\.pdf$/i, "");
    const blob = new Blob([plan.prompt], { type: "text/markdown" });
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
            Paste this into a Claude Code session running in your paper&rsquo;s repo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
          {plan.prompt}
        </div>

        <DialogFooter>
          <Button onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy to clipboard"}
          </Button>
          <Button variant="outline" onClick={download}>
            <Download className="size-4" />
            Download .md
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
