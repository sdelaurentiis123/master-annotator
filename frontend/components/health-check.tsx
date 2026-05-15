"use client";

import useSWR from "swr";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { backendHealth, BackendError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";

function useBackendHealth() {
  return useSWR("backend-health", backendHealth, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
}

function useSupabaseHealth() {
  return useSWR("supabase-health", async () => {
    const supabase = createClient();
    // Cheapest possible call: just ping auth (works without a session).
    const { error } = await supabase.auth.getSession();
    if (error) throw error;
    return { ok: true };
  });
}

export function HealthCheck() {
  const backend = useBackendHealth();
  const supabase = useSupabaseHealth();

  return (
    <Card>
      <CardContent className="grid gap-3 py-4">
        <Row
          label="Backend (FastAPI)"
          loading={backend.isLoading}
          error={backend.error}
          ok={!!backend.data?.ok}
          extra={
            backend.data
              ? `Gemini key: ${backend.data.gemini_key ? "yes" : "no"} · Anthropic key: ${backend.data.anthropic_key ? "yes" : "no"}`
              : undefined
          }
        />
        <Row
          label="Supabase"
          loading={supabase.isLoading}
          error={supabase.error}
          ok={!!supabase.data?.ok}
          extra={process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https:\/\//, "")}
        />
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  loading,
  error,
  ok,
  extra,
}: {
  label: string;
  loading: boolean;
  error: unknown;
  ok: boolean;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <StatusIcon loading={loading} ok={ok && !error} error={!!error} />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {extra && <span className="text-xs text-muted-foreground">{extra}</span>}
        {error instanceof Error && (
          <span className="text-xs text-destructive">
            {error instanceof BackendError ? `${error.status}: ${error.body.slice(0, 100)}` : error.message}
          </span>
        )}
      </div>
      {!loading && (
        <Badge variant={ok && !error ? "default" : "destructive"} className="ml-auto">
          {error ? "error" : ok ? "ok" : "down"}
        </Badge>
      )}
    </div>
  );
}

function StatusIcon({
  loading,
  ok,
  error,
}: {
  loading: boolean;
  ok: boolean;
  error: boolean;
}) {
  if (loading) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  if (error) return <XCircle className="size-4 text-destructive" />;
  if (ok) return <CheckCircle2 className="size-4 text-emerald-600" />;
  return <XCircle className="size-4 text-muted-foreground" />;
}
