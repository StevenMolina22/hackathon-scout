import type { Preferences, SearchCandidate } from "./schemas";

const BING_RSS_ENDPOINT = "https://www.bing.com/search?format=rss&q=";
const MAX_SEARCH_RESULTS_PER_QUERY = 6;
const MAX_ENRICHED_RESULTS = 8;
const PAGE_EXCERPT_LIMIT = 1800;
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type FetchLike = typeof fetch;

export type DiscoveryOptions = {
  signal?: AbortSignal;
  fetch?: FetchLike;
};

export function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function stripHtml(value: string): string {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildSearchQueries(input: Preferences): string[] {
  const topicQuery = input.topics.join(" ");
  const formatQuery = input.remoteOnly ? "remote OR hybrid" : "remote OR in-person";

  return [
    `${topicQuery} hackathon ${input.region} ${formatQuery}`,
    `site:devpost.com ${topicQuery} hackathon ${input.region}`,
    `site:dorahacks.io ${topicQuery} hackathon ${input.region}`,
    `site:ethglobal.com hackathon AI remote`,
  ];
}

export function isLikelyHackathonResult(candidate: {
  title: string;
  url: string;
  snippet: string;
}): boolean {
  const haystack = `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase();
  return /(hackathon|devpost|dorahacks|ethglobal|buildathon|bounty|mlh|luma|eventbrite)/.test(haystack);
}

export function parseRssItems(xml: string): Array<{
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

export async function searchHackathonPages(
  input: Preferences,
  opts: DiscoveryOptions = {},
): Promise<SearchCandidate[]> {
  const fetchImpl = opts.fetch ?? fetch;
  const queries = buildSearchQueries(input);
  const deduped = new Map<string, SearchCandidate>();

  for (const query of queries) {
    let response: Response;
    try {
      response = await fetchImpl(`${BING_RSS_ENDPOINT}${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
        signal: opts.signal,
      });
    } catch {
      continue;
    }

    if (!response.ok) continue;

    const xml = await response.text();
    const items = parseRssItems(xml);

    for (const item of items) {
      if (!isLikelyHackathonResult(item)) continue;
      if (deduped.has(item.url)) continue;

      let host = "";
      try {
        host = new URL(item.url).hostname;
      } catch {
        continue;
      }

      deduped.set(item.url, {
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: host,
        pageExcerpt: "",
      });

      if (deduped.size >= MAX_SEARCH_RESULTS_PER_QUERY * queries.length) break;
    }
  }

  return Array.from(deduped.values()).slice(0, MAX_ENRICHED_RESULTS);
}

export async function fetchPageExcerpt(url: string, opts: DiscoveryOptions = {}): Promise<string> {
  const fetchImpl = opts.fetch ?? fetch;
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: opts.signal,
    });

    if (!response.ok) return "";

    const html = await response.text();
    return truncate(stripHtml(html), PAGE_EXCERPT_LIMIT);
  } catch {
    return "";
  }
}

export async function enrichCandidates(
  candidates: SearchCandidate[],
  opts: DiscoveryOptions = {},
): Promise<SearchCandidate[]> {
  return Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      pageExcerpt: await fetchPageExcerpt(candidate.url, opts),
    })),
  );
}
