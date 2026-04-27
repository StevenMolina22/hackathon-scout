"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw, SearchX } from "lucide-react";

import { HackathonCard } from "@/components/hackathon-card";
import { PrefsSummary } from "@/components/prefs-summary";
import { ProgressIndicator } from "@/components/progress-indicator";
import { RefineInput } from "@/components/refine-input";
import { Button } from "@/components/ui/button";
import { useScoutStream } from "@/lib/use-scout-stream";
import type { Preferences } from "@scout/core/schemas";

type Props = {
  prefs: Preferences;
};

export function ResultsStream({ prefs }: Props) {
  const { status, stage, hackathons, discoveredCount, durationMs, error, restart } =
    useScoutStream(prefs);

  return (
    <div className="flex flex-col gap-6">
      <PrefsSummary prefs={prefs} />

      <ProgressIndicator
        stage={stage}
        status={status}
        discoveredCount={discoveredCount}
        rankedCount={hackathons.length}
        durationMs={durationMs}
      />

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            <span className="text-sm font-medium">Scout hit an error</span>
            <span className="font-mono text-xs opacity-70">{error.code}</span>
          </div>
          <p className="text-sm text-foreground">{error.message}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={restart}>
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/">Edit search</Link>
            </Button>
          </div>
        </div>
      )}

      <ol className="flex flex-col gap-4">
        {hackathons.map((h, i) => (
          <li key={`${h.url}-${i}`}>
            <HackathonCard hackathon={h} rank={i + 1} />
          </li>
        ))}
      </ol>

      {status === "streaming" && hackathons.length === 0 && (
        <SkeletonRows />
      )}

      {status === "done" && hackathons.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
          <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">No matches yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Try widening the time window, clearing &quot;remote only&quot;, or adding more topics.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/">Edit search</Link>
          </Button>
        </div>
      )}

      <RefineInput prefs={prefs} />
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-lg border border-border bg-card/60"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}
