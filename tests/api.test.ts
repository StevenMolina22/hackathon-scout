import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import {
  createApiServer,
  defaultSearchRequest,
  parseSearchRequest,
  type SearchResponsePayload,
} from "../src/api";

test("parseSearchRequest merges overrides with defaults", () => {
  const parsed = parseSearchRequest({
    topics: ["web3", "solana"],
    region: "Global",
    withinDays: 180,
    maxResults: 7,
    remoteOnly: false,
    studentFriendly: false,
  });

  assert.deepEqual(parsed.topics, ["web3", "solana"]);
  assert.equal(parsed.region, "Global");
  assert.equal(parsed.withinDays, 180);
  assert.equal(parsed.maxResults, 7);
  assert.equal(parsed.remoteOnly, false);
  assert.equal(parsed.studentFriendly, false);
});

test("parseSearchRequest falls back to defaults when body is empty", () => {
  assert.deepEqual(parseSearchRequest({}), defaultSearchRequest);
});

test("parseSearchRequest rejects invalid shapes", () => {
  assert.throws(() => parseSearchRequest({ topics: [] }), /at least one topic/i);
  assert.throws(() => parseSearchRequest({ region: "" }), /region/i);
  assert.throws(() => parseSearchRequest({ withinDays: 0 }), />= 1/);
  assert.throws(() => parseSearchRequest({ maxResults: "nope" }), /valid number/i);
});

test("api server serves health and search responses", async () => {
  const fakeResponse: SearchResponsePayload = {
    provider: "openrouter",
    model: "deepseek/deepseek-v4-pro",
    preferences: {
      topics: ["web3"],
      region: "Global",
      withinDays: 180,
      maxResults: 3,
      remoteOnly: false,
      studentFriendly: true,
    },
    hackathons: [],
  };

  const server = createApiServer(async () => fakeResponse);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const search = await fetch(`${base}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topics: ["web3"], region: "Global", maxResults: 3, withinDays: 180, remoteOnly: false }),
  });
  assert.equal(search.status, 200);
  assert.deepEqual(await search.json(), fakeResponse);

  server.close();
  await once(server, "close");
});

test("api server returns 400 on invalid json body", async () => {
  const server = createApiServer(async () => {
    throw new Error("should not run");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad json",
  });

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.error, /invalid json/i);

  server.close();
  await once(server, "close");
});
