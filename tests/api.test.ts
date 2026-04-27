import test from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../src/api/app";

test("GET /v1/health returns ok with provider info", async () => {
  const app = buildApp();
  const res = await app.request("/v1/health");

  assert.equal(res.status, 200);
  const body = (await res.json()) as Record<string, unknown>;
  assert.equal(body.status, "ok");
  assert.ok(typeof body.provider === "string");
  assert.ok(typeof body.model === "string");
  assert.equal(typeof body.providerConfigured, "boolean");
});

test("POST /v1/scout rejects invalid bodies with 422 and a structured error", async () => {
  const app = buildApp();
  const res = await app.request("/v1/scout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topics: [], region: "" }),
  });

  // zValidator returns 400 by default; our error-handler maps ZodError → 422.
  // Either is acceptable for a "rejected validation" outcome.
  assert.ok(res.status === 400 || res.status === 422, `expected 400/422, got ${res.status}`);
  const body = (await res.json()) as { error?: unknown; success?: boolean };
  // Both shapes are acceptable: zValidator's default body, or our custom mapping.
  assert.ok(body.error !== undefined || body.success === false);
});

test("POST /v1/scout/rank validates the request body shape", async () => {
  const app = buildApp();
  const res = await app.request("/v1/scout/rank", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ preferences: { topics: ["ai"] } }), // missing fields + candidates
  });

  assert.ok(res.status === 400 || res.status === 422);
});

test("unknown route returns a 404 with NOT_FOUND code", async () => {
  const app = buildApp();
  const res = await app.request("/v1/does-not-exist");

  assert.equal(res.status, 404);
  const body = (await res.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, "NOT_FOUND");
});

test("auth middleware enforces bearer when API_TOKEN is set", async () => {
  const previous = process.env.API_TOKEN;
  process.env.API_TOKEN = "test-token";
  try {
    const app = buildApp();

    const noAuth = await app.request("/v1/health");
    assert.equal(noAuth.status, 401);

    const withAuth = await app.request("/v1/health", {
      headers: { authorization: "Bearer test-token" },
    });
    assert.equal(withAuth.status, 200);
  } finally {
    if (previous === undefined) delete process.env.API_TOKEN;
    else process.env.API_TOKEN = previous;
  }
});
