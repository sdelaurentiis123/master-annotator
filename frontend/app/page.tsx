import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadDropzone } from "@/components/upload-dropzone";
import { PapersList } from "@/components/papers-list";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader subtitle="reviewer marginalia → LaTeX PR" />

      <main className="mx-auto w-full max-w-3xl px-6 py-16 space-y-14">
        <section className="space-y-3 text-center">
          <p className="kicker">phase 1 · upload + plan + copy prompt</p>
          <h1 className="font-serif text-4xl font-medium tracking-tight">
            Drop a marked-up PDF.
          </h1>
          <p className="text-[var(--ink-2)] max-w-prose mx-auto leading-relaxed">
            Gemini reads every mark on every page. Claude organizes them into an ordered
            plan, classifies each by reviewer intent, and renders a Claude Code prompt you
            can paste into your paper&rsquo;s repo. PR opening lands in Phase&nbsp;2.
          </p>
        </section>

        <section>
          <UploadDropzone />
        </section>

        <section className="space-y-3">
          <p className="kicker">recent</p>
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
      </main>

      <footer className="mt-auto border-t border-[var(--rule)] py-4">
        <p className="mx-auto max-w-6xl px-6 kicker">
          gemini 3.1 pro preview · claude opus 4.7 · supabase
        </p>
      </footer>
    </>
  );
}
