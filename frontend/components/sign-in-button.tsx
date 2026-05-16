"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export function SignInButton({
  variant = "default",
  className,
}: {
  variant?: "default" | "outline";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "repo read:user",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error(`Sign-in failed: ${error.message}`);
      setBusy(false);
    }
    // On success, the browser redirects to GitHub; this component unmounts.
  }

  return (
    <Button variant={variant} onClick={signIn} disabled={busy} className={className}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      Sign in with GitHub
    </Button>
  );
}
