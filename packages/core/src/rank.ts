import { generateText, Output, streamObject } from "ai";

import { ApiError } from "./errors";
import { getModel } from "./providers";
import {
  RankedListSchema,
  type DiscoveredHackathon,
  type Preferences,
  type RankedHackathon,
} from "./schemas";

export type RankOptions = {
  signal?: AbortSignal;
};

export function buildRankingPrompt(
  input: Preferences,
  candidates: DiscoveredHackathon[],
): string {
  return [
    "Rank these discovered hackathons for the user preferences below.",
    `Preferences: topics=${input.topics.join(", ")}; region=${input.region}; remoteOnly=${String(input.remoteOnly)}; withinDays=${input.withinDays}; studentFriendly=${String(input.studentFriendly)}; maxResults=${input.maxResults}.`,
    "Use the candidate data exactly as provided.",
    "Favor official sources, strong topical fit, future dates, and clear student accessibility.",
    "Add a short whyMatch explanation and a score from 0 to 100.",
    `Return the best ${input.maxResults} results as JSON matching the schema.`,
    `Candidates: ${JSON.stringify(candidates)}`,
  ].join(" ");
}

export async function rankHackathons(
  input: Preferences,
  candidates: DiscoveredHackathon[],
  opts: RankOptions = {},
): Promise<RankedHackathon[]> {
  if (candidates.length === 0) return [];

  const { model } = getModel();

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: RankedListSchema }),
      prompt: buildRankingPrompt(input, candidates),
      abortSignal: opts.signal,
    });
    return result.output.hackathons;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiError(502, "LLM_FAILED", "LLM call failed during ranking.", { cause: message });
  }
}

/**
 * Streams ranked hackathons one-by-one as the LLM completes each item in the array.
 * Uses AI SDK v6 `streamObject` with the same schema and emits whenever a new
 * fully-shaped item appears in the partial.
 */
export async function* streamRankedHackathons(
  input: Preferences,
  candidates: DiscoveredHackathon[],
  opts: RankOptions = {},
): AsyncIterable<RankedHackathon> {
  if (candidates.length === 0) return;

  const { model } = getModel();

  let stream;
  try {
    stream = streamObject({
      model,
      schema: RankedListSchema,
      prompt: buildRankingPrompt(input, candidates),
      abortSignal: opts.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiError(502, "LLM_FAILED", "LLM stream failed to start during ranking.", {
      cause: message,
    });
  }

  let emitted = 0;

  try {
    for await (const partial of stream.partialObjectStream) {
      const list = (partial?.hackathons ?? []) as Array<Partial<RankedHackathon>>;
      // Emit any item whose required fields are now present, except the last
      // one (still streaming). Once the stream ends, we flush remaining items.
      const safeCount = Math.max(list.length - 1, 0);
      while (emitted < safeCount) {
        const item = list[emitted];
        if (isCompleteRanked(item)) {
          yield item as RankedHackathon;
        }
        emitted += 1;
      }
    }

    // Final flush — pull the fully resolved object.
    const final = await stream.object;
    const all = final.hackathons;
    while (emitted < all.length) {
      yield all[emitted];
      emitted += 1;
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiError(502, "LLM_FAILED", "LLM stream failed during ranking.", { cause: message });
  }
}

function isCompleteRanked(item: Partial<RankedHackathon> | undefined): item is RankedHackathon {
  if (!item) return false;
  return (
    typeof item.title === "string" &&
    typeof item.url === "string" &&
    typeof item.score === "number" &&
    typeof item.whyMatch === "string"
  );
}
