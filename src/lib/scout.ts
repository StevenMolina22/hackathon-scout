import { discoverHackathons } from "./extract";
import { getModel } from "./providers";
import { rankHackathons, streamRankedHackathons } from "./rank";
import type {
  Preferences,
  RankedHackathon,
  SearchCandidate,
} from "./schemas";

export type ScoutOptions = {
  signal?: AbortSignal;
};

export type ScoutResult = {
  provider: string;
  model: string;
  preferences: Preferences;
  hackathons: RankedHackathon[];
  cached: boolean;
  durationMs: number;
};

export type ScoutEvent =
  | { type: "stage"; stage: "search" | "scrape" | "extract" | "rank"; at: number }
  | { type: "candidate"; candidate: SearchCandidate }
  | { type: "discovered"; count: number }
  | { type: "ranked"; hackathon: RankedHackathon }
  | {
      type: "done";
      summary: {
        provider: string;
        model: string;
        total: number;
        durationMs: number;
        cached: boolean;
      };
    }
  | { type: "error"; code: string; message: string };

export async function runScout(
  prefs: Preferences,
  opts: ScoutOptions = {},
): Promise<ScoutResult> {
  const start = Date.now();
  const { provider, modelId } = getModel();

  const discovered = await discoverHackathons(prefs, { signal: opts.signal });
  const hackathons = await rankHackathons(prefs, discovered, { signal: opts.signal });

  return {
    provider,
    model: modelId,
    preferences: prefs,
    hackathons,
    cached: false,
    durationMs: Date.now() - start,
  };
}

export async function* streamScout(
  prefs: Preferences,
  opts: ScoutOptions = {},
): AsyncIterable<ScoutEvent> {
  const start = Date.now();
  const { provider, modelId } = getModel();
  const elapsed = () => Date.now() - start;

  try {
    yield { type: "stage", stage: "search", at: elapsed() };

    // Discovery is currently a single combined step; we still emit
    // scrape/extract markers so consumers can render progress UX.
    yield { type: "stage", stage: "scrape", at: elapsed() };
    const discovered = await discoverHackathons(prefs, { signal: opts.signal });
    yield { type: "stage", stage: "extract", at: elapsed() };
    yield { type: "discovered", count: discovered.length };

    yield { type: "stage", stage: "rank", at: elapsed() };

    let total = 0;
    for await (const ranked of streamRankedHackathons(prefs, discovered, {
      signal: opts.signal,
    })) {
      total += 1;
      yield { type: "ranked", hackathon: ranked };
    }

    yield {
      type: "done",
      summary: {
        provider,
        model: modelId,
        total,
        durationMs: elapsed(),
        cached: false,
      },
    };
  } catch (error) {
    const code =
      error instanceof Error && "code" in error && typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : "INTERNAL";
    const message = error instanceof Error ? error.message : String(error);
    yield { type: "error", code, message };
  }
}
