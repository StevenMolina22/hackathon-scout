# hackathon-scout

TypeScript service that discovers and ranks upcoming hackathons against a user's
preferences. It ships as both a CLI and a [Hono](https://hono.dev) HTTP API,
backed by the Vercel AI SDK with either OpenAI or OpenRouter.

## Requirements

- Node.js 18+
- `pnpm`
- One provider configured:
  - `OPENAI_API_KEY`, or
  - `OPENROUTER_API_KEY`

## Install

```bash
pnpm install
```

## Configure

Copy `env.example` into your own local env file (or export the variables).

OpenRouter:

```bash
export LLM_PROVIDER=openrouter
export OPENROUTER_API_KEY=your_key_here
export OPENROUTER_MODEL=openai/gpt-4.1-mini
```

OpenAI:

```bash
export LLM_PROVIDER=openai
export OPENAI_API_KEY=your_key_here
export OPENAI_MODEL=gpt-5-mini
```

Optional knobs:

- `MODEL_ID` overrides the model for either provider
- `OPENROUTER_HTTP_REFERER`, `OPENROUTER_APP_TITLE` add OpenRouter app metadata
- `API_TOKEN` enables bearer auth on `/v1/*`
- `CORS_ORIGINS` (comma-separated) restricts CORS; defaults to `*`
- `LOG_LEVEL` = `debug | info | warn | error`

## CLI

```bash
pnpm dev                                    # default search
pnpm dev -- --topics AI,climate --json      # custom search, JSON-only
pnpm dev -- --help                          # full flag reference
```

## HTTP API (Hono)

Local dev:

```bash
pnpm dev:api                # tsx --watch src/server.ts
# or
pnpm api                    # one-shot
```

Default address: `http://127.0.0.1:8787`

The same `buildApp()` is exported by `src/api/app.ts` and reused by both the
Node server (`src/server.ts`) and the Vercel function (`api/index.ts`).

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

Rank a curated list:

```bash
curl -X POST http://127.0.0.1:8787/v1/scout/rank \
  -H 'content-type: application/json' \
  -d '{ "preferences": { ... }, "candidates": [ ... ] }'
```

### Error model

Every error response shares this shape:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",   // see src/lib/errors.ts for the full enum
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

### Vercel

`api/index.ts` re-exports the Hono app via `hono/vercel`. `vercel.json`
rewrites `/v1/*` onto the function and bumps `maxDuration` to 300s for the
long pipeline. No extra config needed beyond the env vars.

### Node container (Railway / Fly / Render / self-host)

```bash
pnpm start                  # node --import tsx src/server.ts
```

`PORT` and `HOST` env vars are honored.

## Repository layout

```text
api/
  index.ts                 # Vercel function entrypoint
src/
  index.ts                 # CLI entrypoint
  server.ts                # Node server entrypoint (@hono/node-server)
  cli.ts                   # CLI flag parsing
  api/
    app.ts                 # buildApp(): Hono instance, routes, middleware
    env.ts                 # AppEnv type
    middleware/            # request-id, logger, auth, error-handler
    routes/                # health, scout, discover, rank
  lib/
    schemas.ts             # zod: Preferences, Discovered, Ranked
    providers.ts           # lazy getModel(), getProviderInfo()
    discovery.ts           # RSS search + scrape + enrichment (pure)
    extract.ts             # discoverHackathons() — LLM call #1
    rank.ts                # rankHackathons(), streamRankedHackathons()
    scout.ts               # runScout(), streamScout() — orchestrator
    errors.ts              # ApiError + code → status map
tests/
  cli.test.ts
  api.test.ts              # exercises buildApp() via Hono's fetch test client
vercel.json
```

## Architecture

`lib/*` is pure TypeScript with zero Hono imports — the CLI, HTTP API, and
(future) MCP server all consume it. `api/*` is transport-only: validation,
auth, error mapping, streaming. Two thin entrypoints (`api/index.ts`,
`src/server.ts`) wrap the same `buildApp()`.

The pipeline:

1. **Discovery** (`lib/discovery.ts`) — Bing RSS search, then lightweight HTML
   scraping for evidence excerpts.
2. **Extraction** (`lib/extract.ts`) — LLM turns the evidence into structured
   `DiscoveredHackathon` candidates (zod-validated).
3. **Filtering** (`lib/extract.ts`) — local code drops bad results, enforces
   the date window + remote preference, and dedupes by title + date.
4. **Ranking** (`lib/rank.ts`) — second LLM call scores and explains each
   candidate; `streamRankedHackathons` yields items as the model produces them.

## Testing

```bash
pnpm typecheck
pnpm test
```

`tests/api.test.ts` uses Hono's built-in `app.request(...)` test client — no
HTTP server needs to be started.
