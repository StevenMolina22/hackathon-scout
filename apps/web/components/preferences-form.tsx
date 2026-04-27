"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TopicsInput } from "@/components/topics-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { encodePrefs } from "@/lib/prefs-encoding";

import { PreferencesSchema } from "@scout/core/schemas";

const TOPIC_SUGGESTIONS = [
  "AI",
  "Climate",
  "Web3",
  "Health",
  "DevTools",
  "Games",
  "Robotics",
  "Education",
];

const REGION_SUGGESTIONS = ["Global", "United States", "Europe", "LATAM", "Asia", "Remote"];

const TIME_WINDOWS = [
  { label: "Next 30 days", value: 30 },
  { label: "Next 60 days", value: 60 },
  { label: "Next 90 days", value: 90 },
  { label: "Next 180 days", value: 180 },
];

export function PreferencesForm() {
  const router = useRouter();
  const [topics, setTopics] = useState<string[]>(["AI"]);
  const [region, setRegion] = useState("Global");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [studentFriendly, setStudentFriendly] = useState(false);
  const [withinDays, setWithinDays] = useState(90);
  const [maxResults, setMaxResults] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const candidate = {
      topics,
      region: region.trim(),
      remoteOnly,
      studentFriendly,
      withinDays,
      maxResults,
    };

    const parsed = PreferencesSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setError(first?.message ?? "Please double-check your inputs.");
      return;
    }

    setSubmitting(true);
    const encoded = encodePrefs(parsed.data);
    router.push(`/results?p=${encoded}`);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <Field
        label="What topics are you into?"
        hint="Pick 1–10 themes. The model uses these to score relevance."
        htmlFor="topics"
      >
        <TopicsInput value={topics} onChange={setTopics} suggestions={TOPIC_SUGGESTIONS} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Region" hint="A country, city, or 'Global'." htmlFor="region">
          <Input
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Global, Europe, NYC"
            list="region-suggestions"
          />
          <datalist id="region-suggestions">
            {REGION_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>

        <Field label="Time window" hint="How far ahead should we look?" htmlFor="within-days">
          <div className="flex flex-wrap gap-2">
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.value}
                type="button"
                onClick={() => setWithinDays(tw.value)}
                aria-pressed={withinDays === tw.value}
                className={
                  withinDays === tw.value
                    ? "rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                    : "rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }
              >
                {tw.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-5 shadow-sm">
        <ToggleRow
          label="Remote only"
          description="Skip in-person and hybrid events."
          checked={remoteOnly}
          onCheckedChange={setRemoteOnly}
        />
        <ToggleRow
          label="Student-friendly"
          description="Favor events that welcome students or beginners."
          checked={studentFriendly}
          onCheckedChange={setStudentFriendly}
        />
      </div>

      <Field
        label="How many results?"
        hint="More results = longer ranking time. We default to 5."
        htmlFor="max-results"
      >
        <div className="flex items-center gap-3">
          <input
            id="max-results"
            type="range"
            min={3}
            max={20}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="h-1 flex-1 accent-[var(--primary)]"
          />
          <span className="font-mono text-sm tabular-nums text-foreground w-8 text-right">
            {maxResults}
          </span>
        </div>
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-xs text-muted-foreground">
          Powered by your <span className="font-mono">@scout/core</span> pipeline.
        </p>
        <Button type="submit" size="lg" disabled={submitting || topics.length === 0}>
          Find hackathons
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor} className="text-foreground">
        {label}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="pt-1">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-6 py-1.5">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}
