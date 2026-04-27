import test from "node:test";
import assert from "node:assert/strict";

import { defaultPreferences, parseCliArgs, resolveRunConfig } from "../src/cli";

test("parseCliArgs supports explicit overrides and output flags", () => {
  const parsed = parseCliArgs([
    "--topics",
    "ai,climate,defi",
    "--region",
    "LATAM",
    "--within-days",
    "30",
    "--max-results",
    "8",
    "--student-friendly",
    "--include-in-person",
    "--json",
  ]);

  assert.equal(parsed.preferences.topics.join(","), "ai,climate,defi");
  assert.equal(parsed.preferences.region, "LATAM");
  assert.equal(parsed.preferences.withinDays, 30);
  assert.equal(parsed.preferences.maxResults, 8);
  assert.equal(parsed.preferences.studentFriendly, true);
  assert.equal(parsed.preferences.remoteOnly, false);
  assert.equal(parsed.outputJson, true);
  assert.equal(parsed.showHelp, false);
});

test("parseCliArgs returns defaults when no args are provided", () => {
  const parsed = parseCliArgs([]);

  assert.deepEqual(parsed.preferences, defaultPreferences);
  assert.equal(parsed.outputJson, false);
  assert.equal(parsed.showHelp, false);
});

test("resolveRunConfig ignores the pnpm argument separator", () => {
  const parsed = resolveRunConfig(["--", "--help"]);

  assert.equal(parsed.showHelp, true);
  assert.deepEqual(parsed.preferences, defaultPreferences);
});

test("resolveRunConfig enables help without mutating defaults", () => {
  const parsed = resolveRunConfig(["--help"]);

  assert.equal(parsed.showHelp, true);
  assert.deepEqual(parsed.preferences, defaultPreferences);
  assert.notEqual(parsed.preferences, defaultPreferences);
});

test("parseCliArgs rejects missing values and invalid numbers", () => {
  assert.throws(() => parseCliArgs(["--region"]), /requires a value/);
  assert.throws(() => parseCliArgs(["--within-days", "0"]), />= 1/);
  assert.throws(() => parseCliArgs(["--max-results", "nope"]), /valid number/);
});
