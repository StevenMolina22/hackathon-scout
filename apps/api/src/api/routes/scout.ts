import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import {
  PreferencesSchema,
  runScout,
  streamScout,
  type ScoutEvent,
} from "@scout/core";
import type { AppEnv } from "../env";

export const scoutRouter = new Hono<AppEnv>();

scoutRouter.post("/", zValidator("json", PreferencesSchema), async (c) => {
  const prefs = c.req.valid("json");
  const url = new URL(c.req.url);
  const wantsStream =
    url.searchParams.get("stream") === "1" ||
    (c.req.header("accept") ?? "").includes("text/event-stream");

  if (wantsStream) {
    return streamSSE(c, async (stream) => {
      const signal = c.req.raw.signal;
      stream.onAbort(() => {
        // The async generator below observes the request signal directly.
      });

      for await (const event of streamScout(prefs, { signal })) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(eventPayload(event)),
        });

        if (event.type === "done" || event.type === "error") {
          break;
        }
      }
    });
  }

  const result = await runScout(prefs, { signal: c.req.raw.signal });
  return c.json(result);
});

function eventPayload(event: ScoutEvent): unknown {
  switch (event.type) {
    case "stage":
      return { stage: event.stage, at: event.at };
    case "candidate":
      return event.candidate;
    case "discovered":
      return { count: event.count };
    case "ranked":
      return event.hackathon;
    case "done":
      return event.summary;
    case "error":
      return { code: event.code, message: event.message };
  }
}
