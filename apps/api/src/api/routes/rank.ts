import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { RankRequestSchema, getModel, rankHackathons } from "@scout/core";
import type { AppEnv } from "../env";

export const rankRouter = new Hono<AppEnv>();

rankRouter.post("/", zValidator("json", RankRequestSchema), async (c) => {
  const { preferences, candidates } = c.req.valid("json");
  const { provider, modelId } = getModel();
  const hackathons = await rankHackathons(preferences, candidates, {
    signal: c.req.raw.signal,
  });

  return c.json({
    provider,
    model: modelId,
    hackathons,
  });
});
