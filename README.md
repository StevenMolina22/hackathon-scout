# hackathon-scout

Minimal TypeScript example for a Vercel AI SDK-powered hackathon finder that can run with either OpenAI or OpenRouter.

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

Copy `env.example` into your own local env file or export the variables in your shell.

OpenRouter example:

```bash
export LLM_PROVIDER=openrouter
export OPENROUTER_API_KEY=your_key_here
export OPENROUTER_MODEL=openai/gpt-4.1-mini
```

OpenAI example:

```bash
export LLM_PROVIDER=openai
export OPENAI_API_KEY=your_key_here
export OPENAI_MODEL=gpt-5-mini
```

Optional knobs:

- `MODEL_ID` overrides the model for either provider
- `OPENROUTER_HTTP_REFERER` and `OPENROUTER_APP_TITLE` add OpenRouter app metadata

## Run

```bash
pnpm dev
```

## Project structure

```text
src/index.ts
tsconfig.json
package.json
env.example
```

## MVP architecture

The current implementation keeps the first version intentionally small.

1. Interface layer
   `src/index.ts` defines a `preferences` object. This can later become CLI args or an HTTP request body.
2. Discovery layer
   The script performs live web discovery through Bing RSS search plus lightweight page scraping.
3. AI SDK extraction layer
   The configured LLM turns raw search evidence into structured hackathon candidates.
4. Normalization and filtering
   Local TypeScript code removes obvious bad results, filters by date window and remote preference, and deduplicates by title plus date.
5. Ranking layer
   A second AI SDK model call ranks the remaining events and explains why each one matches.
6. Output layer
   The script prints both a readable shortlist and machine-friendly JSON.

## OpenRouter notes

- OpenRouter support uses the dedicated `@openrouter/ai-sdk-provider` package.
- The discovery pipeline is provider-agnostic, so OpenRouter does not depend on OpenAI-only web search tools.
- A real OpenRouter API key is required for an end-to-end run.

## Notes

- The project uses ESM, so `package.json` includes `"type": "module"`.
- If `LLM_PROVIDER` is omitted, the script defaults to OpenAI unless only `OPENROUTER_API_KEY` is present.

## Example

```ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const model = openrouter(process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini");

async function main() {
  const result = await generateText({
    model,
    prompt: "Rank these hackathons for an AI builder in Europe",
  });

  console.log(result.text);
}

main();
```
