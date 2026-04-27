import { serve } from "@hono/node-server";

import { buildApp } from "./api/app";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "127.0.0.1";

serve({
  fetch: buildApp().fetch,
  port,
  hostname,
});

console.log(`Hackathon Scout API listening on http://${hostname}:${port}`);
