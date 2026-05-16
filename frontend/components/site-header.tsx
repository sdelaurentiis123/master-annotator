import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { SignInButton } from "@/components/sign-in-button";
import { UserMenu } from "@/components/user-menu";

export async function SiteHeader({
  subtitle,
  right,
}: {
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = user?.user_metadata as
    | { avatar_url?: string; user_name?: string; preferred_username?: string }
    | undefined;
  const username = meta?.user_name ?? meta?.preferred_username ?? null;
  const avatarUrl = meta?.avatar_url ?? null;

  return (
    <header
      className="sticky top-0 z-20 backdrop-blur-[2px]"
      style={{ background: "color-mix(in srgb, var(--paper) 92%, transparent)" }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 border-b border-[var(--rule)] px-6 py-3">
        <Link href="/" className="flex items-baseline gap-3 hover:opacity-80">
          <span className="font-serif text-xl font-semibold tracking-tight">
            master&shy;-annotator
          </span>
          {subtitle && <span className="kicker hidden sm:inline">{subtitle}</span>}
        </Link>
        <nav className="ml-auto flex items-center gap-3">
          {right}
          {user ? (
            <UserMenu
              email={user.email ?? null}
              avatarUrl={avatarUrl}
              username={username}
            />
          ) : (
            <SignInButton variant="outline" />
          )}
        </nav>
      </div>
    </header>
  );
}
