# @scout/web

Placeholder for the future web frontend. When you're ready, scaffold a Next.js
app here and have it import shared schemas/types from `@scout/core`:

```bash
cd apps/web
pnpm create next-app@latest .
pnpm add @scout/core
```

Then call the deployed API (set `NEXT_PUBLIC_API_URL` to the `@scout/api`
deployment URL) or, if `apps/web` and `apps/api` are deployed under the same
domain, hit `/v1/scout` directly.
