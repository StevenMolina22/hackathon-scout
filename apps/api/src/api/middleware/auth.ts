import type { MiddlewareHandler } from "hono";

import { ApiError } from "@scout/core";
import type { AppEnv } from "../env";

/**
 * Bearer-token auth gated on `API_TOKEN`. If the env var is not set, the
 * middleware is a no-op so local dev "just works".
 */
export function auth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const expected = process.env.API_TOKEN?.trim();
    if (!expected) {
      await next();
      return;
    }

    const header = c.req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token || token !== expected) {
      throw new ApiError(401, "UNAUTHORIZED", "Missing or invalid bearer token.");
    }

    c.set("userId", `token:${token.slice(0, 6)}`);
    await next();
  };
}
