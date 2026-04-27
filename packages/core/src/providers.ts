import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

import { ApiError } from "./errors";

export type ProviderName = "openai" | "openrouter";

export type ResolvedModel = {
  provider: ProviderName;
  modelId: string;
  model: LanguageModel;
  /** Provider client factory; needed when callers want to apply per-call options (e.g. OpenRouter web plugin). */
  client: (modelId: string, options?: Record<string, unknown>) => LanguageModel;
};

let cached: ResolvedModel | null = null;

export function getProviderName(): ProviderName {
  const explicit = process.env.LLM_PROVIDER?.trim().toLowerCase();

  if (explicit === "openrouter") return "openrouter";
  if (explicit === "openai") return "openai";

  if (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    return "openrouter";
  }

  return "openai";
}

export function getModelId(provider: ProviderName): string {
  if (process.env.MODEL_ID?.trim()) {
    return process.env.MODEL_ID.trim();
  }

  if (provider === "openrouter") {
    return process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4.1-mini";
  }

  return process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
}

/**
 * Lazy resolution of the LLM provider. Throws an ApiError if the required
 * API key is missing — never at module import time.
 */
export function getModel(): ResolvedModel {
  if (cached) return cached;

  const provider = getProviderName();
  const modelId = getModelId(provider);

  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new ApiError(
        503,
        "PROVIDER_NOT_CONFIGURED",
        "OPENROUTER_API_KEY is required when LLM_PROVIDER=openrouter.",
      );
    }

    const client = createOpenRouter({
      apiKey,
      headers: {
        ...(process.env.OPENROUTER_HTTP_REFERER
          ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
          : {}),
        ...(process.env.OPENROUTER_APP_TITLE
          ? { "X-Title": process.env.OPENROUTER_APP_TITLE }
          : {}),
      },
    });

    cached = {
      provider,
      modelId,
      model: client(modelId),
      client: (id, options) =>
        options ? (client as unknown as (id: string, opts: unknown) => LanguageModel)(id, options) : client(id),
    };
    return cached;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new ApiError(
      503,
      "PROVIDER_NOT_CONFIGURED",
      "OPENAI_API_KEY is required when LLM_PROVIDER=openai (or when no provider is specified).",
    );
  }

  const client = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  cached = {
    provider,
    modelId,
    model: client(modelId),
    client: (id) => client(id),
  };
  return cached;
}

/** Non-throwing variant for `/health`. */
export function getProviderInfo(): {
  provider: ProviderName;
  modelId: string;
  hasKey: boolean;
} {
  const provider = getProviderName();
  const modelId = getModelId(provider);
  const hasKey =
    provider === "openrouter"
      ? Boolean(process.env.OPENROUTER_API_KEY)
      : Boolean(process.env.OPENAI_API_KEY);

  return { provider, modelId, hasKey };
}

/** Test helper: clear the lazy cache between runs. */
export function _resetProviderCache(): void {
  cached = null;
}
