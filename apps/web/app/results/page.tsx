import Link from "next/link";
import { redirect } from "next/navigation";

import { ResultsStream } from "@/components/results-stream";
import { SiteHeader } from "@/components/site-header";
import { decodePrefs } from "@/lib/prefs-encoding";

type SearchParams = { p?: string };

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const prefs = decodePrefs(params.p ?? "");

  if (!prefs) {
    redirect("/");
  }

  return (
    <div className="min-h-dvh bg-background pb-32">
      <SiteHeader />

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 pt-10">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="w-fit text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← New search
          </Link>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Scouting hackathons for you…
          </h1>
        </div>

        <ResultsStream prefs={prefs} />
      </main>
    </div>
  );
}
