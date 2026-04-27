import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import { ApiError, codeToStatus, type ApiErrorCode } from "../../lib/errors";
import type { AppEnv } from "../env";

export function errorHandler(err: Error, c: Context<AppEnv>): Response {
  const requestId = c.get("requestId");
  const log = c.get("log");

  if (err instanceof ApiError) {
    log?.warn("api_error", {
      code: err.code,
      status: err.status,
      message: err.message,
    });
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          requestId,
          details: err.details,
        },
      },
      // Cast: Hono's StatusCode union is narrower than `number`.
      err.status as 400,
    );
  }

  if (err instanceof ZodError) {
    log?.warn("validation_error", { issues: err.issues });
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR" satisfies ApiErrorCode,
          message: "Request validation failed.",
          requestId,
          details: err.issues,
        },
      },
      422,
    );
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: {
          code: err.status === 404 ? "NOT_FOUND" : "INTERNAL",
          message: err.message,
          requestId,
        },
      },
      err.status,
    );
  }

  if (err.name === "AbortError") {
    log?.warn("aborted", { message: err.message });
    return c.json(
      {
        error: {
          code: "TIMEOUT" satisfies ApiErrorCode,
          message: "Request was aborted.",
          requestId,
        },
      },
      codeToStatus.TIMEOUT as 504,
    );
  }

  log?.error("internal_error", { message: err.message, stack: err.stack });
  return c.json(
    {
      error: {
        code: "INTERNAL" satisfies ApiErrorCode,
        message: "Internal server error.",
        requestId,
      },
    },
    500,
  );
}
