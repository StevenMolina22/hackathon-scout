"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { encodePrefs } from "@/lib/prefs-encoding";
import type { Preferences } from "@scout/core/schemas";

type Props = {
  prefs: Preferences;
};

const PROMPT_PRESETS = [
  "Make these more beginner-friendly",
  "Closer to home",
  "Bigger prize pools",
  "Shorter time commitment",
];

/**
 * Lightweight "refine" UX: parses natural language hints and folds them into
 * the existing preferences. We do NOT call the LLM here — this is purely a
 * client-side mapper that nudges the structured fields and re-runs /v1/scout.
 */
export function RefineInput({ prefs }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState("");

  const submit = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const next = applyHint(prefs, text);
    router.push(`/results?p=${encodePrefs(next)}`);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(draft);
  };

  return (
    <div className="sticky bottom-4 z-10">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <Sparkles className="ml-1 h-4 w-4 text-primary" aria-hidden />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Refine: try 'remote only' or 'next 30 days'"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Refine search"
          />
          <Button type="submit" size="sm" disabled={draft.trim().length === 0}>
            Refine
          </Button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
          {PROMPT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => submit(preset)}
              className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function applyHint(prefs: Preferences, hintRaw: string): Preferences {
  const hint = hintRaw.toLowerCase();
  const next: Preferences = { ...prefs };

  if (/(remote only|only remote)/.test(hint)) next.remoteOnly = true;
  if (/(in[- ]person|hybrid|on[- ]site)/.test(hint)) next.remoteOnly = false;

  if (/(beginner|student|learner|first[- ]time)/.test(hint)) next.studentFriendly = true;

  const daysMatch = hint.match(/(\d{1,3})\s*(?:d|day|days)/);
  if (daysMatch) next.withinDays = clamp(parseInt(daysMatch[1], 10), 1, 365);
  else if (/(this month|next 30)/.test(hint)) next.withinDays = 30;
  else if (/(next 60|two months)/.test(hint)) next.withinDays = 60;
  else if (/(next quarter|next 90|three months)/.test(hint)) next.withinDays = 90;
  else if (/(next 180|six months|half year)/.test(hint)) next.withinDays = 180;

  const moreMatch = hint.match(/(\d{1,2})\s*results?/);
  if (moreMatch) next.maxResults = clamp(parseInt(moreMatch[1], 10), 1, 20);
  else if (/(more results|more options|wider)/.test(hint)) {
    next.maxResults = clamp(prefs.maxResults + 5, 1, 20);
  } else if (/(fewer|narrower|tighter)/.test(hint)) {
    next.maxResults = clamp(prefs.maxResults - 2, 1, 20);
  }

  if (/(closer to home|near me|local)/.test(hint) && prefs.region.toLowerCase() === "global") {
    // best-effort; user can still edit region from the form
    next.region = prefs.region;
  }

  // Pull bare topic-like words: "ai", "climate", "web3" if mentioned and not already present
  const TOPIC_HINTS = ["ai", "climate", "web3", "health", "robotics", "games", "education", "devtools"];
  for (const t of TOPIC_HINTS) {
    if (hint.includes(t) && !next.topics.map((x) => x.toLowerCase()).includes(t)) {
      next.topics = [...next.topics, t.toUpperCase() === "AI" ? "AI" : capitalize(t)].slice(0, 10);
    }
  }

  return next;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
