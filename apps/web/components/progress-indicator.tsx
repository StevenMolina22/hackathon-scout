import { Check, Loader2 } from "lucide-react";

import type { ScoutStage } from "@/lib/scout-client";
import { cn } from "@/lib/utils";

const STAGES: { id: ScoutStage; label: string }[] = [
  { id: "search", label: "Searching" },
  { id: "scrape", label: "Reading sources" },
  { id: "extract", label: "Extracting" },
  { id: "rank", label: "Ranking" },
];

type Props = {
  stage: ScoutStage | null;
  status: "idle" | "streaming" | "done" | "error";
  discoveredCount: number | null;
  rankedCount: number;
  durationMs: number | null;
};

export function ProgressIndicator({ stage, status, discoveredCount, rankedCount, durationMs }: Props) {
  const stageIndex = stage ? STAGES.findIndex((s) => s.id === stage) : -1;
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {STAGES.map((s, i) => {
          const reached = isDone ? true : i < stageIndex;
          const active = !isDone && !isError && i === stageIndex;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-mono",
                  reached
                    ? "border-accent bg-accent/10 text-accent"
                    : active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground",
                )}
              >
                {reached ? (
                  <Check className="h-3 w-3" aria-hidden />
                ) : active ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  reached ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < STAGES.length - 1 && (
                <span className="hidden h-px w-6 bg-border sm:inline-block" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {discoveredCount !== null && (
          <span>
            Found <span className="font-mono text-foreground">{discoveredCount}</span> candidates
          </span>
        )}
        <span>
          Ranked <span className="font-mono text-foreground">{rankedCount}</span> so far
        </span>
        {durationMs !== null && isDone && (
          <span>
            Done in <span className="font-mono text-foreground">{(durationMs / 1000).toFixed(1)}s</span>
          </span>
        )}
      </div>
    </div>
  );
}
