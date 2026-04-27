# hackathon-scout

A pnpm workspace monorepo. Discovers and ranks upcoming hackathons against a
user's preferences via the Vercel AI SDK with either OpenAI or OpenRouter.

```text
hackathon-scout/
  packages/
    core/        # @scout/core — pure pipeline (schemas, providers, discovery,
                 #               extract, rank, scout). No HTTP, no Hono.
  apps/
    api/         # @scout/api  — Hono HTTP API, Vercel function, Node CLI.
                 #               Imports @scout/core. Deployed to Vercel.
    web/         # placeholder for the future web frontend.
```

The split mirrors the architecture: **`@scout/core` is pure logic**, **`@scout/api`
is transport**. The CLI, HTTP API, and any future MCP server all consume the
same `runScout` / `streamScout` from core.

## Requirements

- Node.js 18+
- `pnpm` 10+
- One LLM provider configured: `OPENAI_API_KEY` or `OPENROUTER_API_KEY`

## Install

```bash
pnpm install        # installs everything and links @scout/core into apps/api
```

## Configure

Copy `env.example` and export the variables locally (or use a tool like
`direnv` / `dotenv-cli`). See `env.example` for the full list.

## CLI (apps/api)

The CLI calls `runScout` from `@scout/core` directly — it does not hit the
deployed API. Run it from the repo root:

```bash
pnpm dev                                    # default search
pnpm dev -- --topics AI,climate --json      # custom search, JSON-only
pnpm dev -- --help                          # full flag reference
```

Or scoped to the package:

```bash
pnpm --filter @scout/api dev -- --topics AI,climate
```

## HTTP API (apps/api)

Local dev:

```bash
pnpm dev:api        # tsx --watch in apps/api
pnpm api            # one-shot (no watch)
```

Default address: `http://127.0.0.1:8787`

The same `buildApp()` is exported by `apps/api/src/api/app.ts` and reused by
both the Node server (`apps/api/src/server.ts`) and the Vercel function
(`apps/api/api/index.ts`).

### Routes

| Method | Path                  | Purpose                                          |
| -----: | --------------------- | ------------------------------------------------ |
|  `GET` | `/v1/health`          | Liveness + provider status                       |
| `POST` | `/v1/scout`           | Full pipeline: discover + rank (JSON or SSE)     |
| `POST` | `/v1/scout/discover`  | Discovery only (debug, no ranking)               |
| `POST` | `/v1/scout/rank`      | Rank a list of pre-discovered candidates         |

All `POST` bodies are validated with zod; errors return `422 VALIDATION_ERROR`
with the failing issues in `error.details`.

### Examples

Health:

```bash
curl http://127.0.0.1:8787/v1/health
```

Full pipeline (JSON):

```bash
curl -X POST http://127.0.0.1:8787/v1/scout \
  -H 'content-type: application/json' \
  -d '{
    "topics": ["AI", "climate"],
    "region": "Europe",
    "withinDays": 90,
    "maxResults": 5,
    "remoteOnly": true,
    "studentFriendly": true
  }'
```

Full pipeline (Server-Sent Events — items stream as they're ranked):

```bash
curl -N -X POST http://127.0.0.1:8787/v1/scout \
  -H 'content-type: application/json' \
  -H 'accept: text/event-stream' \
  -d '{ "topics": ["AI"], "region": "Europe" }'
```

The SSE stream emits `event: stage`, `event: discovered`, `event: ranked`, and
finally `event: done` (or `event: error`).

### Error model

Every error response shares this shape:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",   // see packages/core/src/errors.ts for the full enum
    "message": "Request validation failed.",
    "requestId": "…",
    "details": [ /* optional, e.g. zod issues */ ]
  }
}
```

| Code                       | HTTP | When                                                |
| -------------------------- | ---: | --------------------------------------------------- |
| `VALIDATION_ERROR`         |  422 | Body failed zod validation                          |
| `UNAUTHORIZED`             |  401 | Missing/invalid bearer when `API_TOKEN` is set      |
| `RATE_LIMITED`             |  429 | (Reserved) Upstash sliding-window denies request    |
| `PROVIDER_NOT_CONFIGURED`  |  503 | No API key for the selected LLM provider            |
| `UPSTREAM_FETCH_FAILED`    |  502 | RSS/HTML fetch failed across all sources            |
| `LLM_FAILED`               |  502 | LLM call/output schema mismatch                     |
| `TIMEOUT`                  |  504 | Hard deadline reached                               |
| `INTERNAL`                 |  500 | Anything else                                       |

## Deploy

### Vercel (recommended)

Create a Vercel project pointing at this repo with **Root Directory =
`apps/api`**. Vercel auto-detects the pnpm workspace at the repo root and
runs `pnpm install` from there, so `@scout/core` is linked correctly inside
the function bundle.

- `apps/api/api/index.ts` is the function entrypoint (Node runtime, `maxDuration: 300`).
- `apps/api/vercel.json` rewrites `/v1/*` → `/api/index`.
- Set env vars (`OPENAI_API_KEY` *or* `OPENROUTER_API_KEY`, plus optional
  `CORS_ORIGINS`, `API_TOKEN`, etc.) in the Vercel dashboard.
- `maxDuration: 300` requires Pro + Fluid Compute. On Hobby, lower it to `60`.

When `apps/web` is added later, create a **second** Vercel project with Root
Directory = `apps/web`. Deploy them independently; they share `@scout/core`
through the workspace.

### Node container (Railway / Fly / Render / self-host)

```bash
pnpm start          # node --import tsx in apps/api
```

`PORT` and `HOST` env vars are honored.

## Architecture

`packages/core/*` is pure TypeScript with zero Hono imports — the CLI, HTTP
API, and (future) MCP server all consume it. `apps/api/src/api/*` is
transport-only: validation, auth, error mapping, streaming. Two thin
entrypoints (`apps/api/api/index.ts`, `apps/api/src/server.ts`) wrap the same
`buildApp()`.

The pipeline:

1. **Discovery** (`core/discovery.ts`) — Bing RSS search, then lightweight HTML
   scraping for evidence excerpts.
2. **Extraction** (`core/extract.ts`) — LLM turns the evidence into structured
   `DiscoveredHackathon` candidates (zod-validated).
3. **Filtering** (`core/extract.ts`) — local code drops bad results, enforces
   the date window + remote preference, and dedupes by title + date.
4. **Ranking** (`core/rank.ts`) — second LLM call scores and explains each
   candidate; `streamRankedHackathons` yields items as the model produces them.

## Testing

```bash
pnpm typecheck      # runs tsc --noEmit in every package
pnpm test           # runs each package's test script
```

`apps/api/tests/api.test.ts` uses Hono's built-in `app.request(...)` test
client — no HTTP server needs to be started.
