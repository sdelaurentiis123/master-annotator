import Link from "next/link";

export function SiteHeader({
  subtitle,
  right,
}: {
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 backdrop-blur-[2px]" style={{ background: "color-mix(in srgb, var(--paper) 92%, transparent)" }}>
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 border-b border-[var(--rule)] px-6 py-3">
        <Link href="/" className="flex items-baseline gap-3 hover:opacity-80">
          <span className="font-serif text-xl font-semibold tracking-tight">
            master&shy;-annotator
          </span>
          {subtitle && (
            <span className="kicker hidden sm:inline">{subtitle}</span>
          )}
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link href="/" className="kicker hover:text-foreground">
            papers
          </Link>
          {right}
        </nav>
      </div>
    </header>
  );
}
