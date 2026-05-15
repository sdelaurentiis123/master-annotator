import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HealthCheck } from "@/components/health-check";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">master-annotator</h1>
        <p className="text-muted-foreground">
          Upload a marked-up PDF → get an ordered, classified plan of edits → ship a Claude
          Code prompt or a GitHub PR.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          System
        </h2>
        <HealthCheck />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Upload
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Drop a PDF (next slice)</CardTitle>
            <CardDescription>
              The upload dropzone lands in Slice 2. Slice 1 just verifies that the frontend
              talks to the backend and Supabase env vars are present.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            For now: <Link href="#" className="underline">stay tuned</Link>.
          </CardContent>
        </Card>
      </section>

      <footer className="text-xs text-muted-foreground space-x-2">
        <Badge variant="outline">phase 1</Badge>
        <span>slice 1 in progress</span>
      </footer>
    </main>
  );
}
