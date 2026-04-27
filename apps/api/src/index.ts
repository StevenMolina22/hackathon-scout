import { runScout, type RankedHackathon } from "@scout/core";

import { getHelpText, resolveRunConfig } from "./cli";

function printSummary(hackathons: RankedHackathon[], provider: string, modelId: string): void {
  if (hackathons.length === 0) {
    console.log("No matching hackathons found.");
    return;
  }

  console.log(`Top hackathons via ${provider}/${modelId}:\n`);

  for (const [index, hackathon] of hackathons.entries()) {
    console.log(`${index + 1}. ${hackathon.title} (${hackathon.score}/100)`);
    console.log(`   ${hackathon.url}`);
    console.log(`   ${hackathon.startDate} -> ${hackathon.endDate}`);
    console.log(`   ${hackathon.location} | format=${hackathon.format}`);
    console.log(`   ${hackathon.whyMatch}`);
    console.log("");
  }
}

async function main() {
  const runConfig = resolveRunConfig(process.argv.slice(2));

  if (runConfig.showHelp) {
    console.log(getHelpText());
    return;
  }

  const result = await runScout(runConfig.preferences);

  const payload = {
    provider: result.provider,
    model: result.model,
    preferences: result.preferences,
    hackathons: result.hackathons,
  };

  if (!runConfig.outputJson) {
    printSummary(result.hackathons, result.provider, result.model);
    console.log("Structured output:\n");
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
