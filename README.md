# hackathon-scout

Minimal TypeScript example for a Vercel AI SDK-powered hackathon finder.

## Requirements

- Node.js 18+
- `pnpm`
- `OPENAI_API_KEY` configured in your shell

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

## Project structure

```text
src/index.ts
tsconfig.json
package.json
```

## MVP architecture

The current implementation keeps the first version intentionally small.

1. Interface layer
   `src/index.ts` defines a `preferences` object. This can later become CLI args or an HTTP request body.
2. AI SDK orchestrator
   Vercel AI SDK receives the search intent and produces structured JSON instead of free-form text.
3. Discovery layer
   The first pass uses OpenAI web search through Vercel AI SDK to find candidate hackathons.
4. Normalization and filtering
   Local TypeScript code removes obvious bad results, filters by date window and remote preference, and deduplicates by title plus date.
5. Ranking layer
   A second AI SDK model call ranks the remaining events and explains why each one matches.
6. Output layer
   The script prints both a readable shortlist and machine-friendly JSON.

## Where Firecrawl fits

If you add Firecrawl, the best place is between discovery and ranking.

1. Use Firecrawl `search` for candidate URLs when you want more control than built-in web search.
2. Use Firecrawl `scrape` or `agent` to extract fields from each candidate page.
3. Keep the local normalization and dedup step.
4. Let the AI SDK model call continue to handle ranking and summarization.

That split keeps deterministic data collection in code and leaves interpretation to the agent.

## Notes

- The project uses ESM, so `package.json` includes `"type": "module"`.
- Set `OPENAI_MODEL` to override the default `gpt-5-mini` model.

## Example

```ts
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const model = openai(process.env.OPENAI_MODEL ?? "gpt-5-mini");

async function main() {
  const result = await generateText({
    model,
    tools: {
      web_search: openai.tools.webSearch({}),
    },
    prompt: "Find upcoming remote AI hackathons in Europe",
  });

  console.log(result.text);
}

main();
```
