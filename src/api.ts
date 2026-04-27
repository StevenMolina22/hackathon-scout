import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { defaultPreferences, type HackathonPreferences } from "./cli";

const execFileAsync = promisify(execFile);

export type SearchResponsePayload = {
  provider: string;
  model: string;
  preferences: HackathonPreferences;
  hackathons: Array<Record<string, unknown>>;
};

export const defaultSearchRequest: HackathonPreferences = {
  ...defaultPreferences,
  topics: [...defaultPreferences.topics],
};

export type SearchRunner = (
  preferences: HackathonPreferences,
) => Promise<SearchResponsePayload>;

function parsePositiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be a valid number.`);
  }

  if ((value as number) < 1) {
    throw new Error(`${field} must be >= 1.`);
  }

  return value as number;
}

function parseTopics(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("topics must be an array of strings.");
  }

  const topics = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (topics.length === 0) {
    throw new Error("topics must include at least one topic.");
  }

  return topics;
}

export function parseSearchRequest(body: Record<string, unknown>): HackathonPreferences {
  const preferences: HackathonPreferences = {
    ...defaultSearchRequest,
    topics: [...defaultSearchRequest.topics],
  };

  if (body.topics !== undefined) {
    preferences.topics = parseTopics(body.topics);
  }

  if (body.region !== undefined) {
    if (typeof body.region !== "string" || body.region.trim() === "") {
      throw new Error("region must be a non-empty string.");
    }
    preferences.region = body.region.trim();
  }

  if (body.withinDays !== undefined) {
    preferences.withinDays = parsePositiveInteger(body.withinDays, "withinDays");
  }

  if (body.maxResults !== undefined) {
    preferences.maxResults = parsePositiveInteger(body.maxResults, "maxResults");
  }

  if (body.remoteOnly !== undefined) {
    if (typeof body.remoteOnly !== "boolean") {
      throw new Error("remoteOnly must be a boolean.");
    }
    preferences.remoteOnly = body.remoteOnly;
  }

  if (body.studentFriendly !== undefined) {
    if (typeof body.studentFriendly !== "boolean") {
      throw new Error("studentFriendly must be a boolean.");
    }
    preferences.studentFriendly = body.studentFriendly;
  }

  return preferences;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Request body must be a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON error.";
    throw new Error(`Invalid JSON body: ${message}`);
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

export function createCliSearchRunner(cwd = process.cwd()): SearchRunner {
  return async (preferences) => {
    const args = [
      "src/index.ts",
      "--json",
      "--topics",
      preferences.topics.join(","),
      "--region",
      preferences.region,
      "--within-days",
      String(preferences.withinDays),
      "--max-results",
      String(preferences.maxResults),
      preferences.remoteOnly ? "--remote-only" : "--include-in-person",
      preferences.studentFriendly ? "--student-friendly" : "--no-student-friendly",
    ];

    const { stdout } = await execFileAsync("pnpm", ["exec", "tsx", ...args], {
      cwd,
      env: process.env,
      maxBuffer: 1024 * 1024 * 10,
    });

    return JSON.parse(stdout) as SearchResponsePayload;
  };
}

export function createApiServer(searchRunner: SearchRunner): Server {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && url.pathname === "/search") {
        const body = await readJsonBody(req);
        const preferences = parseSearchRequest(body);
        const result = await searchRunner(preferences);
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { error: "Not found." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      const statusCode = /invalid json|must|requires|non-empty|at least one topic/i.test(message)
        ? 400
        : 500;
      sendJson(res, statusCode, { error: message });
    }
  });
}
