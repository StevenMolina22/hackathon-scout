import { PreferencesForm } from "@/components/preferences-form";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />

      <main className="relative">
        <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />

        <section className="relative mx-auto flex max-w-3xl flex-col gap-10 px-6 pb-16 pt-16 sm:pt-24">
          <header className="flex flex-col gap-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Live LLM ranking
            </span>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Find hackathons worth your weekend.
            </h1>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Tell Scout what you care about. It searches the web, reads the
              listings, and ranks the best matches for you in real time —
              with a short reason for each pick.
            </p>
          </header>

          <PreferencesForm />
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
        Built on <span className="font-mono">@scout/core</span> · Hono · AI SDK
      </footer>
    </div>
  );
}
