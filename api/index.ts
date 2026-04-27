import { handle } from "hono/vercel";

import { buildApp } from "../src/api/app";

// Use Node, not Edge — the discovery pipeline does many parallel fetches to
// arbitrary HTML hosts and benefits from Node's larger memory and longer
// timeouts.
export const config = { runtime: "nodejs" };

// Fluid Compute on Pro: bump max duration well past the default to allow the
// long discovery + ranking pipeline (10–60s) to finish.
export const maxDuration = 300;

const app = buildApp();

export default handle(app);
