import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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

type SearchCandidate = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  pageExcerpt: string;
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

type ProviderName = "openai" | "openrouter";

const BING_RSS_ENDPOINT = "https://www.bing.com/search?format=rss&q=";
const MAX_SEARCH_RESULTS_PER_QUERY = 6;
const MAX_ENRICHED_RESULTS = 8;
const PAGE_EXCERPT_LIMIT = 1800;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

function getProviderName(): ProviderName {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();

  if (explicit === "openrouter") {
    return "openrouter";
  }

  if (explicit === "openai") {
    return "openai";
  }

  if (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    return "openrouter";
  }

  return "openai";
}

function getModelId(provider: ProviderName): string {
  if (process.env.MODEL_ID?.trim()) {
    return process.env.MODEL_ID.trim();
  }

  if (provider === "openrouter") {
    return process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4.1-mini";
  }

  return process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
}

function createProvider() {
  const provider = getProviderName();

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is required when LLM_PROVIDER=openrouter.",
      );
    }

    return {
      provider,
      modelId: getModelId(provider),
      client: createOpenRouter({
        apiKey,
        headers: {
          ...(process.env.OPENROUTER_HTTP_REFERER
            ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
            : {}),
          ...(process.env.OPENROUTER_APP_TITLE
            ? { "X-Title": process.env.OPENROUTER_APP_TITLE }
            : {}),
        },
      }),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required when LLM_PROVIDER=openai (or when no provider is specified).",
    );
  }

  return {
    provider,
    modelId: getModelId(provider),
    client: createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  };
}

const llm = createProvider();
const model = llm.client(llm.modelId);

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value: string): string {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildSearchQueries(input: HackathonPreferences): string[] {
  const topicQuery = input.topics.join(" ");
  const formatQuery = input.remoteOnly ? "remote OR hybrid" : "remote OR in-person";

  return [
    `${topicQuery} hackathon ${input.region} ${formatQuery}`,
    `site:devpost.com ${topicQuery} hackathon ${input.region}`,
    `site:dorahacks.io ${topicQuery} hackathon ${input.region}`,
    `site:ethglobal.com hackathon AI remote`,
  ];
}

function isLikelyHackathonResult(candidate: {
  title: string;
  url: string;
  snippet: string;
}): boolean {
  const haystack = `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase();

  return /(hackathon|devpost|dorahacks|ethglobal|buildathon|bounty|mlh|luma|eventbrite)/.test(
    haystack,
  );
}

function parseRssItems(xml: string): Array<{
  title: string;
  url: string;
  snippet: string;
}> {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

  return items
    .map((match) => {
      const block = match[1];
      const title = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
      const url = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
      const snippet = stripHtml(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "");

      return { title, url, snippet };
    })
    .filter((item) => item.title && item.url);
}

async function searchHackathonPages(
  input: HackathonPreferences,
): Promise<SearchCandidate[]> {
  const deduped = new Map<string, SearchCandidate>();

  for (const query of buildSearchQueries(input)) {
    const response = await fetch(`${BING_RSS_ENDPOINT}${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });

    if (!response.ok) {
      continue;
    }

    const xml = await response.text();
    const items = parseRssItems(xml);

    for (const item of items) {
      if (!isLikelyHackathonResult(item)) {
        continue;
      }

      if (!deduped.has(item.url)) {
        deduped.set(item.url, {
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          source: new URL(item.url).hostname,
          pageExcerpt: "",
        });
      }

      if (deduped.size >= MAX_SEARCH_RESULTS_PER_QUERY * buildSearchQueries(input).length) {
        break;
      }
    }
  }

  return Array.from(deduped.values()).slice(0, MAX_ENRICHED_RESULTS);
}

async function fetchPageExcerpt(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    const cleaned = stripHtml(html);

    return truncate(cleaned, PAGE_EXCERPT_LIMIT);
  } catch {
    return "";
  }
}

async function enrichCandidates(
  candidates: SearchCandidate[],
): Promise<SearchCandidate[]> {
  return Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      pageExcerpt: await fetchPageExcerpt(candidate.url),
    })),
  );
}

function buildDiscoveryPrompt(
  input: HackathonPreferences,
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
    "Use only the supplied evidence. Do not invent facts.",
    "If a field is unknown, return an empty string or empty array instead of guessing.",
    "If a result is clearly not a hackathon or looks expired, omit it.",
    `Return at most ${Math.max(input.maxResults * 2, 8)} candidates as JSON matching the schema.`,
    `Evidence: ${JSON.stringify(candidates)}`,
  ].join(" ");
}

function buildRankingPrompt(
  input: HackathonPreferences,
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
  const rawCandidates = await searchHackathonPages(input);
  const enrichedCandidates = await enrichCandidates(rawCandidates);

  if (enrichedCandidates.length === 0) {
    return [];
  }

  const result = await generateText({
    model,
    output: Output.object({ schema: discoveredHackathonSchema }),
    prompt: buildDiscoveryPrompt(input, enrichedCandidates),
  });

  return normalizeAndFilter(result.output.hackathons, input);
}

async function rankHackathons(
  input: HackathonPreferences,
  candidates: DiscoveredHackathon[],
): Promise<RankedHackathon[]> {
  if (candidates.length === 0) {
    return [];
  }

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

  console.log(`Top hackathons via ${llm.provider}/${llm.modelId}:\n`);

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
  console.log(
    JSON.stringify(
      {
        provider: llm.provider,
        model: llm.modelId,
        preferences,
        hackathons: ranked,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
