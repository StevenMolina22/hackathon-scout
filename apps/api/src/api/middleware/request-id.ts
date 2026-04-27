import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";

import type { AppEnv } from "../env";

const HEADER = "x-request-id";

export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incoming = c.req.header(HEADER);
    const id = incoming && incoming.length > 0 && incoming.length <= 200 ? incoming : randomUUID();
    c.set("requestId", id);
    c.header(HEADER, id);
    await next();
  };
}
