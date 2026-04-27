import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import {
  PreferencesSchema,
  discoverHackathonsWithEvidence,
  getModel,
} from "@scout/core";
import type { AppEnv } from "../env";

export const discoverRouter = new Hono<AppEnv>();

discoverRouter.post("/", zValidator("json", PreferencesSchema), async (c) => {
  const prefs = c.req.valid("json");
  const { provider, modelId } = getModel();
  const { candidates, hackathons } = await discoverHackathonsWithEvidence(prefs, {
    signal: c.req.raw.signal,
  });

  return c.json({
    provider,
    model: modelId,
    candidates,
    hackathons,
  });
});
