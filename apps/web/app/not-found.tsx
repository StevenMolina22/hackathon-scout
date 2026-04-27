import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">404</p>
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
        That page wandered off.
      </h1>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      >
        ← Start a new search
      </Link>
    </div>
  );
}
