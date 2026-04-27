import { Calendar, ExternalLink, MapPin, Sparkles, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RankedHackathon } from "@scout/core/schemas";
import { cn, deadlineLabel, formatDateRange } from "@/lib/utils";

type Props = {
  hackathon: RankedHackathon;
  rank: number;
};

export function HackathonCard({ hackathon, rank }: Props) {
  const deadline = deadlineLabel(hackathon.deadline);
  const score = Math.round(hackathon.score);
  const scoreTone = score >= 80 ? "accent" : score >= 60 ? "primary" : "muted";

  return (
    <Card className="fade-in-up flex flex-col gap-5 p-6 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">#{String(rank).padStart(2, "0")}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{hackathon.organizer || hackathon.source}</span>
          </div>
          <a
            href={hackathon.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-baseline gap-2 text-balance text-lg font-semibold leading-tight tracking-tight text-foreground hover:text-primary"
          >
            <span>{hackathon.title}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
          </a>
        </div>

        <ScoreBadge score={score} tone={scoreTone} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono text-foreground">
            {formatDateRange(hackathon.startDate, hackathon.endDate)}
          </span>
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px]",
            deadline.tone === "urgent" && "bg-destructive/10 text-destructive",
            deadline.tone === "soon" && "bg-primary/10 text-primary",
            deadline.tone === "ok" && "bg-muted text-muted-foreground",
            deadline.tone === "passed" && "bg-muted text-muted-foreground line-through",
            deadline.tone === "unknown" && "bg-muted text-muted-foreground",
          )}
        >
          {deadline.text}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          <span className="text-foreground">{hackathon.location || "—"}</span>
          <Badge variant="outline" className="ml-1 capitalize">
            {hackathon.format}
          </Badge>
        </span>
        {hackathon.prize && (
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            <span className="font-mono text-foreground">{hackathon.prize}</span>
          </span>
        )}
      </div>

      {hackathon.themes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hackathon.themes.slice(0, 8).map((theme) => (
            <Badge key={theme} variant="secondary" className="font-normal">
              {theme}
            </Badge>
          ))}
        </div>
      )}

      {hackathon.summary && (
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {hackathon.summary}
        </p>
      )}

      <div className="rounded-md border border-accent/20 bg-accent/5 p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-accent">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Why this match
        </div>
        <p className="mt-1.5 text-pretty text-sm leading-relaxed text-foreground">
          {hackathon.whyMatch}
        </p>
      </div>
    </Card>
  );
}

function ScoreBadge({ score, tone }: { score: number; tone: "accent" | "primary" | "muted" }) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border",
        tone === "accent" && "border-accent/30 bg-accent/10 text-accent",
        tone === "primary" && "border-primary/30 bg-primary/10 text-primary",
        tone === "muted" && "border-border bg-muted text-muted-foreground",
      )}
      aria-label={`Match score: ${score}`}
    >
      <span className="font-mono text-xl font-semibold leading-none">{score}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider opacity-70">match</span>
    </div>
  );
}
