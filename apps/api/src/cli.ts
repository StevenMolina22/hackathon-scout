export type HackathonPreferences = {
  topics: string[];
  region: string;
  remoteOnly: boolean;
  withinDays: number;
  studentFriendly: boolean;
  maxResults: number;
};

export type RunConfig = {
  preferences: HackathonPreferences;
  outputJson: boolean;
  showHelp: boolean;
};

export const defaultPreferences: HackathonPreferences = {
  topics: ["AI", "climate"],
  region: "Europe",
  remoteOnly: true,
  withinDays: 90,
  studentFriendly: true,
  maxResults: 5,
};

function clonePreferences(preferences: HackathonPreferences): HackathonPreferences {
  return {
    ...preferences,
    topics: [...preferences.topics],
  };
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${flag} must be a valid number.`);
  }

  if (parsed < 1) {
    throw new Error(`${flag} must be >= 1.`);
  }

  return parsed;
}

function parseTopics(value: string): string[] {
  const topics = value
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean);

  if (topics.length === 0) {
    throw new Error("--topics must include at least one topic.");
  }

  return topics;
}

export function parseCliArgs(args: string[]): RunConfig {
  const preferences = clonePreferences(defaultPreferences);
  let outputJson = false;
  let showHelp = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--topics":
        preferences.topics = parseTopics(readValue(args, index, arg));
        index += 1;
        break;
      case "--region":
        preferences.region = readValue(args, index, arg).trim();
        index += 1;
        break;
      case "--within-days":
        preferences.withinDays = parsePositiveInteger(readValue(args, index, arg), arg);
        index += 1;
        break;
      case "--max-results":
        preferences.maxResults = parsePositiveInteger(readValue(args, index, arg), arg);
        index += 1;
        break;
      case "--student-friendly":
        preferences.studentFriendly = true;
        break;
      case "--no-student-friendly":
        preferences.studentFriendly = false;
        break;
      case "--remote-only":
        preferences.remoteOnly = true;
        break;
      case "--include-in-person":
        preferences.remoteOnly = false;
        break;
      case "--json":
        outputJson = true;
        break;
      case "--help":
      case "-h":
        showHelp = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!preferences.region.trim()) {
    throw new Error("--region cannot be empty.");
  }

  return {
    preferences,
    outputJson,
    showHelp,
  };
}

export function resolveRunConfig(args: string[]): RunConfig {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;

  return parseCliArgs(normalizedArgs);
}

export function getHelpText(): string {
  return [
    "Hackathon Scout CLI",
    "",
    "Usage:",
    "  pnpm dev -- [options]",
    "",
    "Options:",
    "  --topics <a,b,c>           Comma-separated topics to search for",
    "  --region <name>            Region to prioritize",
    "  --within-days <number>     Time window in days",
    "  --max-results <number>     Maximum ranked results to return",
    "  --student-friendly         Prefer student-friendly events",
    "  --no-student-friendly      Do not prioritize student-friendly events",
    "  --remote-only             Only allow remote or hybrid hackathons",
    "  --include-in-person       Allow in-person hackathons too",
    "  --json                    Print JSON only",
    "  --help, -h                Show this help message",
    "",
    "Example:",
    "  pnpm dev -- --topics AI,climate,agents --region Europe --within-days 120 --max-results 8 --json",
  ].join("\n");
}
