import type { Preferences } from "@scout/core/schemas";

export type ScoutStage = "search" | "scrape" | "extract" | "rank";

export type ParsedScoutEvent =
  | { type: "stage"; stage: ScoutStage; at: number }
  | { type: "candidate"; candidate: { title: string; url: string; source: string } }
  | { type: "discovered"; count: number }
  | { type: "ranked"; hackathon: import("@scout/core/schemas").RankedHackathon }
  | { type: "done"; summary: { provider: string; model: string; total: number; durationMs: number; cached: boolean } }
  | { type: "error"; code: string; message: string };

export function getApiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/$/, "") : "";
}

function authHeaders(): Record<string, string> {
  const token = process.env.NEXT_PUBLIC_API_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Opens an SSE stream against POST /v1/scout?stream=1 and yields parsed events.
 * EventSource only supports GET, so we use fetch + ReadableStream parsing.
 */
export async function* streamScout(
  prefs: Preferences,
  signal: AbortSignal,
): AsyncGenerator<ParsedScoutEvent> {
  const base = getApiBase();
  const res = await fetch(`${base}/v1/scout?stream=1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...authHeaders(),
    },
    body: JSON.stringify(prefs),
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => null);
    }
    const message =
      typeof detail === "object" && detail && "error" in detail && (detail as { error?: { message?: string } }).error?.message
        ? (detail as { error: { message: string } }).error.message
        : `Request failed with status ${res.status}`;
    yield { type: "error", code: `HTTP_${res.status}`, message };
    return;
  }

  if (!res.body) {
    yield { type: "error", code: "NO_BODY", message: "Server returned an empty stream." };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIdx: number;
      while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIdx);
        buffer = buffer.slice(separatorIdx + 2);
        const parsed = parseSseChunk(rawEvent);
        if (parsed) yield parsed;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }
}

function parseSseChunk(raw: string): ParsedScoutEvent | null {
  if (!raw.trim()) return null;
  let eventName = "message";
  const dataLines: string[] = [];
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length === 0) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
  return mapEvent(eventName, payload);
}

function mapEvent(name: string, payload: unknown): ParsedScoutEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  switch (name) {
    case "stage":
      return { type: "stage", stage: data.stage as ScoutStage, at: Number(data.at) || 0 };
    case "candidate":
      return {
        type: "candidate",
        candidate: {
          title: String(data.title ?? ""),
          url: String(data.url ?? ""),
          source: String(data.source ?? ""),
        },
      };
    case "discovered":
      return { type: "discovered", count: Number(data.count) || 0 };
    case "ranked":
      return {
        type: "ranked",
        hackathon: data as unknown as import("@scout/core/schemas").RankedHackathon,
      };
    case "done":
      return {
        type: "done",
        summary: {
          provider: String(data.provider ?? ""),
          model: String(data.model ?? ""),
          total: Number(data.total) || 0,
          durationMs: Number(data.durationMs) || 0,
          cached: Boolean(data.cached),
        },
      };
    case "error":
      return {
        type: "error",
        code: String(data.code ?? "UNKNOWN"),
        message: String(data.message ?? "Something went wrong."),
      };
    default:
      return null;
  }
}
