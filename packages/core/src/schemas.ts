import { z } from "zod";

export const PreferencesSchema = z.object({
  topics: z.array(z.string().min(1)).min(1).max(10),
  region: z.string().min(1),
  remoteOnly: z.boolean().default(false),
  withinDays: z.number().int().min(1).max(365).default(90),
  studentFriendly: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(20).default(5),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const EventFormatEnum = z.enum(["remote", "hybrid", "in-person", "unknown"]);
export type EventFormat = z.infer<typeof EventFormatEnum>;

export const DiscoveredHackathonSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  organizer: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  deadline: z.string(),
  location: z.string(),
  format: EventFormatEnum,
  themes: z.array(z.string()),
  prize: z.string(),
  summary: z.string(),
});
export type DiscoveredHackathon = z.infer<typeof DiscoveredHackathonSchema>;

export const DiscoveredListSchema = z.object({
  hackathons: z.array(DiscoveredHackathonSchema),
});

export const RankedHackathonSchema = DiscoveredHackathonSchema.extend({
  whyMatch: z.string(),
  score: z.number().min(0).max(100),
});
export type RankedHackathon = z.infer<typeof RankedHackathonSchema>;

export const RankedListSchema = z.object({
  hackathons: z.array(RankedHackathonSchema),
});

export const RankRequestSchema = z.object({
  preferences: PreferencesSchema,
  candidates: z.array(DiscoveredHackathonSchema).min(1).max(50),
});
export type RankRequest = z.infer<typeof RankRequestSchema>;

export type SearchCandidate = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  pageExcerpt: string;
};
