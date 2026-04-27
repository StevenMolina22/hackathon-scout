import type { MiddlewareHandler } from "hono";

import type { AppEnv, Logger } from "../env";

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

function levelEnabled(target: Level): boolean {
  const configured = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
  const idx = LEVELS.indexOf(configured);
  const tgt = LEVELS.indexOf(target);
  if (idx < 0) return true;
  return tgt >= idx;
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (!levelEnabled(level)) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function makeLogger(base: Record<string, unknown> = {}): Logger {
  return {
    debug: (msg, fields) => emit("debug", msg, { ...base, ...fields }),
    info: (msg, fields) => emit("info", msg, { ...base, ...fields }),
    warn: (msg, fields) => emit("warn", msg, { ...base, ...fields }),
    error: (msg, fields) => emit("error", msg, { ...base, ...fields }),
  };
}

export function logger(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = Date.now();
    const requestId = c.get("requestId");
    const log = makeLogger({ requestId });
    c.set("log", log);

    await next();

    const durationMs = Date.now() - start;
    log.info("request", {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs,
      userAgent: c.req.header("user-agent"),
    });
  };
}
