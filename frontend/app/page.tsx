import { Suspense } from "react";
import { cookies } from "next/headers";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadDropzone } from "@/components/upload-dropzone";
import { PapersList } from "@/components/papers-list";
import { SiteHeader } from "@/components/site-header";
import { SignInButton } from "@/components/sign-in-button";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-6 py-24 space-y-10 text-center">
          <div className="space-y-3">
            <p className="kicker">reviewer marginalia, applied</p>
            <h1 className="font-serif text-5xl font-medium tracking-tight">
              Drop an annotated paper.
              <br />
              Ship the edits.
            </h1>
            <p className="mx-auto max-w-prose text-[var(--ink-2)] leading-relaxed">
              Gemini reads every reviewer mark on every page. Claude organizes them into
              an ordered plan. Sign in with GitHub and our agent opens a pull request on
              your paper&rsquo;s repo with the fixes applied.
            </p>
          </div>
          <SignInButton className="px-6 py-3 text-base" />
          <p className="kicker">
            github oauth -- repo scope -- supabase auth
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader subtitle="reviewer marginalia -> LaTeX PR" />

      <main className="mx-auto w-full max-w-3xl px-6 py-12 space-y-10">
        <section className="space-y-3">
          <p className="kicker">upload</p>
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Drop a marked-up PDF.
          </h1>
          <UploadDropzone userId={user.id} />
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
          gemini 3.1 pro preview -- claude opus 4.7 -- supabase
        </p>
      </footer>
    </>
  );
}
