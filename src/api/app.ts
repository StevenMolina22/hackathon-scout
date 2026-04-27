import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import type { AppEnv } from "./env";
import { auth } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { logger } from "./middleware/logger";
import { requestId } from "./middleware/request-id";
import { discoverRouter } from "./routes/discover";
import { healthRouter } from "./routes/health";
import { rankRouter } from "./routes/rank";
import { scoutRouter } from "./routes/scout";

export function buildApp() {
  const app = new Hono<AppEnv>();

  app.use("*", requestId());
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: parseOrigins(process.env.CORS_ORIGINS),
      credentials: false,
    }),
  );
  app.use("*", secureHeaders());
  app.use("/v1/*", auth());

  app.route("/v1/health", healthRouter);
  app.route("/v1/scout/discover", discoverRouter);
  app.route("/v1/scout/rank", rankRouter);
  // /v1/scout LAST so it doesn't shadow the more specific subroutes above.
  app.route("/v1/scout", scoutRouter);

  app.onError(errorHandler);
  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Route not found.",
          requestId: c.get("requestId"),
        },
      },
      404,
    ),
  );

  return app;
}

function parseOrigins(raw: string | undefined): string | string[] {
  if (!raw || raw.trim() === "" || raw.trim() === "*") return "*";
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}
