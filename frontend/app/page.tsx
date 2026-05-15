import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadDropzone } from "@/components/upload-dropzone";
import { PapersList } from "@/components/papers-list";
import { HealthCheck } from "@/components/health-check";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">master-annotator</h1>
        <p className="text-muted-foreground">
          Upload a marked-up PDF → get an ordered, classified plan of edits → ship a Claude
          Code prompt or a GitHub PR.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Upload
        </h2>
        <UploadDropzone />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Recent papers
        </h2>
        <Suspense
          fallback={
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          }
        >
          <PapersList />
        </Suspense>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          System
        </h2>
        <HealthCheck />
      </section>

      <footer className="text-xs text-muted-foreground space-x-2">
        <Badge variant="outline">phase 1</Badge>
        <span>slice 2 — upload + view</span>
      </footer>
    </main>
  );
}
