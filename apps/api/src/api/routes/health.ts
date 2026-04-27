import { Hono } from "hono";

import { getProviderInfo } from "@scout/core";
import type { AppEnv } from "../env";

export const healthRouter = new Hono<AppEnv>();

const startedAt = Date.now();

healthRouter.get("/", (c) => {
  const info = getProviderInfo();
  return c.json({
    status: "ok",
    provider: info.provider,
    model: info.modelId,
    providerConfigured: info.hasKey,
    cache: process.env.UPSTASH_REDIS_REST_URL ? "enabled" : "disabled",
    uptime: (Date.now() - startedAt) / 1000,
  });
});
