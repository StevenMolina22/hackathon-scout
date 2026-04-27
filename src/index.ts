import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

type HackathonPreferences = {
  topics: string[];
  region: string;
  remoteOnly: boolean;
  withinDays: number;
  studentFriendly: boolean;
  maxResults: number;
};

type DiscoveredHackathon = {
  title: string;
  url: string;
  source: string;
  organizer: string;
  startDate: string;
  endDate: string;
  deadline: string;
  location: string;
  remote: boolean;
  themes: string[];
  prize: string;
  summary: string;
};

type RankedHackathon = DiscoveredHackathon & {
  whyMatch: string;
  score: number;
};

const model = openai(process.env.OPENAI_MODEL ?? "gpt-5-mini");

const preferences: HackathonPreferences = {
  topics: ["AI", "climate"],
  region: "Europe",
  remoteOnly: true,
  withinDays: 90,
  studentFriendly: true,
  maxResults: 5,
};

const discoveredHackathonSchema = z.object({
  hackathons: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      source: z.string(),
      organizer: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      deadline: z.string(),
      location: z.string(),
      remote: z.boolean(),
      themes: z.array(z.string()),
      prize: z.string(),
      summary: z.string(),
    }),
  ),
});

const rankedHackathonSchema = z.object({
  hackathons: z.array(
    discoveredHackathonSchema.shape.hackathons.element.extend({
      whyMatch: z.string(),
      score: z.number(),
    }),
  ),
});

function buildDiscoveryPrompt(input: HackathonPreferences): string {
  const remoteLine = input.remoteOnly ? "remote or hybrid hackathons only" : "remote and in-person hackathons";

  return [
    "Find upcoming hackathons using live web search.",
    `Topics: ${input.topics.join(", ")}.`,
    `Region: ${input.region}.`,
    `Time window: next ${input.withinDays} days.`,
    `Format: ${remoteLine}.`,
    `Student-friendly: ${input.studentFriendly ? "prefer student-friendly events" : "not required"}.`,
    "Prefer official event pages over aggregators.",
    "Exclude expired events or pages without a clear source URL.",
    "If a field is unknown, return an empty string or empty array instead of inventing data.",
    `Return at most ${Math.max(input.maxResults * 2, 8)} candidates as JSON matching the schema.`,
  ].join(" ");
}

function buildRankingPrompt(input: HackathonPreferences, candidates: DiscoveredHackathon[]): string {
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

function isFutureDateWithinWindow(value: string, withinDays: number): boolean {
  if (!value) {
    return true;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  const now = new Date();
  const latest = new Date(now);
  latest.setDate(now.getDate() + withinDays);

  return parsed >= now && parsed <= latest;
}

function normalizeAndFilter(
  candidates: DiscoveredHackathon[],
  input: HackathonPreferences,
): DiscoveredHackathon[] {
  const deduped = new Map<string, DiscoveredHackathon>();

  for (const candidate of candidates) {
    if (!candidate.url.trim()) {
      continue;
    }

    if (input.remoteOnly && !candidate.remote) {
      continue;
    }

    if (!isFutureDateWithinWindow(candidate.startDate, input.withinDays)) {
      continue;
    }

    const key = `${candidate.title.toLowerCase()}::${candidate.startDate.toLowerCase()}`;

    if (!deduped.has(key)) {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values());
}

async function discoverHackathons(
  input: HackathonPreferences,
): Promise<DiscoveredHackathon[]> {
  const result = await generateText({
    model,
    output: Output.object({ schema: discoveredHackathonSchema }),
    tools: {
      web_search: openai.tools.webSearch({
        searchContextSize: "high",
      }),
    },
    toolChoice: { type: "tool", toolName: "web_search" },
    prompt: buildDiscoveryPrompt(input),
  });

  return normalizeAndFilter(result.output.hackathons, input);
}

async function rankHackathons(
  input: HackathonPreferences,
  candidates: DiscoveredHackathon[],
): Promise<RankedHackathon[]> {
  const result = await generateText({
    model,
    output: Output.object({ schema: rankedHackathonSchema }),
    prompt: buildRankingPrompt(input, candidates),
  });

  return result.output.hackathons;
}

function printSummary(hackathons: RankedHackathon[]): void {
  if (hackathons.length === 0) {
    console.log("No matching hackathons found.");
    return;
  }

  console.log("Top hackathons:\n");

  for (const [index, hackathon] of hackathons.entries()) {
    console.log(`${index + 1}. ${hackathon.title} (${hackathon.score}/100)`);
    console.log(`   ${hackathon.url}`);
    console.log(`   ${hackathon.startDate} -> ${hackathon.endDate}`);
    console.log(`   ${hackathon.location} | remote=${String(hackathon.remote)}`);
    console.log(`   ${hackathon.whyMatch}`);
    console.log("");
  }
}

async function main() {
  const discovered = await discoverHackathons(preferences);
  const ranked = await rankHackathons(preferences, discovered);

  printSummary(ranked);

  console.log("Structured output:\n");
  console.log(JSON.stringify({ preferences, hackathons: ranked }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
