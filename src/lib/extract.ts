import { generateText, Output } from "ai";

import { enrichCandidates, searchHackathonPages } from "./discovery";
import { ApiError } from "./errors";
import { getModel } from "./providers";
import {
  DiscoveredListSchema,
  type DiscoveredHackathon,
  type EventFormat,
  type Preferences,
  type SearchCandidate,
} from "./schemas";

export type ExtractOptions = {
  signal?: AbortSignal;
};

export function buildNativeDiscoveryPrompt(input: Preferences): string {
  const remoteLine = input.remoteOnly
    ? "remote or hybrid hackathons only"
    : "remote, hybrid, and in-person hackathons";
  const today = new Date().toISOString().slice(0, 10);

  return [
    "Find upcoming hackathons using live web search.",
    `Today's date is ${today}.`,
    `Topics: ${input.topics.join(", ")}.`,
    `Region: ${input.region}.`,
    `Time window: next ${input.withinDays} days.`,
    `Format: ${remoteLine}.`,
    `Student-friendly: ${input.studentFriendly ? "prefer student-friendly events" : "not required"}.`,
    'For the format field, use exactly one of: "remote", "hybrid", "in-person", or "unknown".',
    "Prefer official event pages over aggregators.",
    "Exclude expired events or pages without a clear source URL.",
    "Use the year shown on the source page and return ISO dates in YYYY-MM-DD format whenever possible.",
    "Do not convert clearly upcoming 2026 events into past 2025 dates.",
    "If a field is unknown, return an empty string or empty array instead of inventing data.",
    `Return at most ${Math.max(input.maxResults * 2, 8)} candidates as JSON matching the schema.`,
    "If few exact matches exist, still return the best relevant upcoming hackathons instead of an empty list.",
  ].join(" ");
}

export function buildEvidenceDiscoveryPrompt(
  input: Preferences,
  candidates: SearchCandidate[],
): string {
  const remoteLine = input.remoteOnly
    ? "remote or hybrid hackathons only"
    : "remote and in-person hackathons";

  return [
    "You are given live search results and scraped page excerpts for possible hackathons.",
    "Extract only real upcoming hackathons from the evidence below.",
    `Topics: ${input.topics.join(", ")}.`,
    `Region: ${input.region}.`,
    `Time window: next ${input.withinDays} days when dates are available.`,
    `Format: ${remoteLine}.`,
    `Student-friendly: ${input.studentFriendly ? "prefer student-friendly events" : "not required"}.`,
    'For the format field, use exactly one of: "remote", "hybrid", "in-person", or "unknown".',
    "Use only the supplied evidence. Do not invent facts.",
    "If a field is unknown, return an empty string or empty array instead of guessing.",
    "If a result is clearly not a hackathon or looks expired, omit it.",
    `Return at most ${Math.max(input.maxResults * 2, 8)} candidates as JSON matching the schema.`,
    `Evidence: ${JSON.stringify(candidates)}`,
  ].join(" ");
}

function parseOptionalDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isFutureDateWithinWindow(value: string, withinDays: number): boolean {
  const date = parseOptionalDate(value);
  if (!date) return false;

  const now = new Date();
  const latest = new Date(now);
  latest.setDate(now.getDate() + withinDays);

  return date >= now && date <= latest;
}

function isHackathonActiveOrUpcoming(
  candidate: DiscoveredHackathon,
  withinDays: number,
): boolean {
  const now = new Date();
  const latest = new Date(now);
  latest.setDate(now.getDate() + withinDays);

  const start = parseOptionalDate(candidate.startDate);
  const end = parseOptionalDate(candidate.endDate);
  const deadline = parseOptionalDate(candidate.deadline);
  const dates = [start, end, deadline].filter((value): value is Date => value !== null);

  if (dates.length === 0) return true;

  if (start && start >= now && start <= latest) return true;
  if (deadline && deadline >= now && deadline <= latest) return true;
  if (end && end >= now && end <= latest) return true;
  if (start && end && start <= now && end >= now) return true;
  if (start && deadline && start <= now && deadline >= now) return true;

  return false;
}

function isAcceptableFormat(format: EventFormat, remoteOnly: boolean): boolean {
  if (!remoteOnly) return true;
  return format === "remote" || format === "hybrid";
}

export function normalizeAndFilter(
  candidates: DiscoveredHackathon[],
  input: Preferences,
): DiscoveredHackathon[] {
  const deduped = new Map<string, DiscoveredHackathon>();

  for (const candidate of candidates) {
    if (!candidate.url.trim()) continue;
    if (!isAcceptableFormat(candidate.format, input.remoteOnly)) continue;
    if (!isHackathonActiveOrUpcoming(candidate, input.withinDays)) continue;

    const key = `${candidate.title.toLowerCase()}::${candidate.startDate.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values());
}

function getOpenRouterDiscoveryModel(input: Preferences) {
  const { client, modelId } = getModel();
  return client(modelId, {
    plugins: [
      {
        id: "web",
        max_results: Math.max(input.maxResults * 2, 8),
        search_prompt: `Find upcoming ${input.remoteOnly ? "remote or hybrid " : ""}${input.topics.join("/")} hackathons in ${input.region} within the next ${input.withinDays} days. Prefer official event pages.`,
      },
      { id: "response-healing" },
    ],
  });
}

export async function discoverHackathons(
  input: Preferences,
  opts: ExtractOptions = {},
): Promise<DiscoveredHackathon[]> {
  const llm = getModel();

  if (llm.provider === "openrouter") {
    try {
      const result = await generateText({
        model: getOpenRouterDiscoveryModel(input),
        output: Output.object({ schema: DiscoveredListSchema }),
        prompt: buildNativeDiscoveryPrompt(input),
        abortSignal: opts.signal,
      });
      return normalizeAndFilter(result.output.hackathons, input);
    } catch (error) {
      throw wrapLlmError(error);
    }
  }

  let rawCandidates: SearchCandidate[];
  try {
    rawCandidates = await searchHackathonPages(input, { signal: opts.signal });
  } catch (error) {
    throw new ApiError(
      502,
      "UPSTREAM_FETCH_FAILED",
      "Failed to fetch hackathon search results.",
      { cause: stringifyError(error) },
    );
  }

  const enrichedCandidates = await enrichCandidates(rawCandidates, { signal: opts.signal });

  if (enrichedCandidates.length === 0) {
    return [];
  }

  try {
    const result = await generateText({
      model: llm.model,
      output: Output.object({ schema: DiscoveredListSchema }),
      prompt: buildEvidenceDiscoveryPrompt(input, enrichedCandidates),
      abortSignal: opts.signal,
    });
    return normalizeAndFilter(result.output.hackathons, input);
  } catch (error) {
    throw wrapLlmError(error);
  }
}

/** Variant that also returns the raw candidates — used by `/v1/scout/discover`. */
export async function discoverHackathonsWithEvidence(
  input: Preferences,
  opts: ExtractOptions = {},
): Promise<{ candidates: SearchCandidate[]; hackathons: DiscoveredHackathon[] }> {
  const llm = getModel();

  if (llm.provider === "openrouter") {
    const hackathons = await discoverHackathons(input, opts);
    return { candidates: [], hackathons };
  }

  let rawCandidates: SearchCandidate[];
  try {
    rawCandidates = await searchHackathonPages(input, { signal: opts.signal });
  } catch (error) {
    throw new ApiError(
      502,
      "UPSTREAM_FETCH_FAILED",
      "Failed to fetch hackathon search results.",
      { cause: stringifyError(error) },
    );
  }

  const enrichedCandidates = await enrichCandidates(rawCandidates, { signal: opts.signal });

  if (enrichedCandidates.length === 0) {
    return { candidates: [], hackathons: [] };
  }

  try {
    const result = await generateText({
      model: llm.model,
      output: Output.object({ schema: DiscoveredListSchema }),
      prompt: buildEvidenceDiscoveryPrompt(input, enrichedCandidates),
      abortSignal: opts.signal,
    });
    return {
      candidates: enrichedCandidates,
      hackathons: normalizeAndFilter(result.output.hackathons, input),
    };
  } catch (error) {
    throw wrapLlmError(error);
  }
}

function wrapLlmError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(502, "LLM_FAILED", "LLM call failed during discovery.", {
    cause: stringifyError(error),
  });
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
