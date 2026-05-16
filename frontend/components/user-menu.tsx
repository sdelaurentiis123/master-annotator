"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export function UserMenu({
  email,
  avatarUrl,
  username,
}: {
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(`Sign-out failed: ${error.message}`);
      setBusy(false);
      return;
    }
    router.refresh();
    router.push("/");
  }

  const initials = (username || email || "?")
    .split(/[@\s]/)[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-2 py-1 text-xs hover:bg-[var(--paper-3)]"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={username ?? "you"} className="size-5 rounded-full" />
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full bg-[var(--ink)] text-[10px] text-[var(--paper)]">
            {initials}
          </span>
        )}
        <span className="kicker normal-case font-medium">{username ?? email}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-md border border-[var(--rule)] bg-[var(--paper-2)] py-1 shadow-md z-30">
          <button
            onMouseDown={(e) => {
              e.preventDefault(); // avoid blur closing before click
              signOut();
            }}
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--paper-3)] disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <LogOut className="size-3" />}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
