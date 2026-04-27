# @scout/web

Next.js 16 frontend for Hackathon Scout. Streams ranked hackathons from
`@scout/api` over Server-Sent Events.

## Local dev

```bash
# 1. Start the API (from repo root)
pnpm dev:api          # http://localhost:3000

# 2. In another terminal, start the web app
cp apps/web/.env.example apps/web/.env.local
# Set NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
pnpm dev:web          # http://localhost:3001
```

The API allows all CORS origins by default, so localhost dev "just works"
unless you've set `CORS_ORIGINS` on the API.

## Architecture

- `app/page.tsx` — preferences form, encodes prefs into the URL.
- `app/results/page.tsx` — server component that decodes the URL and renders
  `<ResultsStream>`.
- `components/results-stream.tsx` — client component, opens an SSE stream to
  `/v1/scout?stream=1` and renders cards as they arrive.
- `components/refine-input.tsx` — natural-language refinement that re-encodes
  prefs and navigates; no extra LLM call.
- `lib/scout-client.ts` — `fetch`-based SSE parser (EventSource only supports
  GET, so we roll our own for POST + SSE).
- `@scout/core/schemas` — zod schemas reused on the form so input validation
  matches the API contract exactly.

## Deploy

Two Vercel projects, both pointing at this monorepo:

| Project    | Root Directory | Domain (example)        |
| ---------- | -------------- | ----------------------- |
| scout-api  | `apps/api`     | `api.scout.dev`         |
| scout-web  | `apps/web`     | `scout.dev`             |

On the web project set `NEXT_PUBLIC_API_BASE_URL=https://api.scout.dev`. If
you set `SCOUT_API_TOKEN` on the API, mirror it as `NEXT_PUBLIC_API_TOKEN`
here (note: this exposes the token to browsers — only use a token you're
willing to make public, e.g. a soft rate-limit key).
