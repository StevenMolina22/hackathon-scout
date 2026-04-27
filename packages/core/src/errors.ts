export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "PROVIDER_NOT_CONFIGURED"
  | "UPSTREAM_FETCH_FAILED"
  | "LLM_FAILED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "TIMEOUT"
  | "NOT_FOUND"
  | "INTERNAL";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const codeToStatus: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  PROVIDER_NOT_CONFIGURED: 503,
  UPSTREAM_FETCH_FAILED: 502,
  LLM_FAILED: 502,
  TIMEOUT: 504,
  NOT_FOUND: 404,
  INTERNAL: 500,
};
