import { createApiServer, createCliSearchRunner } from "./api";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

const server = createApiServer(createCliSearchRunner(process.cwd()));

server.listen(port, host, () => {
  console.log(`Hackathon Scout API listening on http://${host}:${port}`);
});
