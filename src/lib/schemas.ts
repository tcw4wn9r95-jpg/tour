// Zod schemas for everything Claude returns. They double as the structured
// output format sent to the API, so the model's JSON always parses.
import { z } from "zod/v4";

// The SDK sends enums to the API as hints (in the description), not hard
// constraints, so every enum falls back to a safe value instead of failing the
// whole answer if Claude invents a new label.
const mood = z
  .enum(["warm", "majestic", "lively", "mellow", "mysterious", "romantic"])
  .catch("warm")
  .describe("Mood of the background music under this narration");

const category = z.enum([
  "food",
  "architecture",
  "history",
  "museum",
  "culture",
  "nature",
  "viewpoint",
  "market",
  "neighborhood",
  "religious",
])
  .catch("neighborhood");

export const PlanSchema = z.object({
  title: z.string().describe("Evocative tour title, max ~6 words"),
  subtitle: z.string().describe("One line: what kind of day this is"),
  city: z.string().describe("City name in English"),
  region: z.string().describe("State / province / region the city belongs to, in English"),
  country: z.string().describe("Country in English"),
  center: z.object({ lat: z.number(), lng: z.number() }),
  startTime: z
    .string()
    .nullable()
    .describe('Local start time "HH:MM" only if the traveler asked to start later than now; otherwise null'),
  longLegMode: z
    .enum(["transit", "car"])
    .catch("transit")
    .describe("How to cover legs longer than 1 km walking, honouring the traveler's preference"),
  intro: z.object({
    headline: z.string().describe("The guide's one-sentence opening, like greeting a group at the start of a full-day tour"),
    welcome: z.array(z.string()).describe("2-3 short paragraphs: what this tour focuses on and the story that ties the day together"),
    themes: z.array(z.string()).describe("3-5 short theme labels"),
    whatToExpect: z.array(z.string()).describe("3-5 practical expectations: pace, terrain, where you'll eat, highlights"),
  }),
  tips: z.array(z.string()).describe("3-5 local tips for today (tickets, dress code, safety, etiquette)"),
  stops: z
    .array(
      z.object({
        name: z.string().describe("Official name of the place"),
        wikipediaTitle: z.string().nullable().describe("Exact English Wikipedia article title if one exists, else null"),
        lat: z.number(),
        lng: z.number(),
        category,
        durationMin: z.number().describe("Minutes to spend at the stop"),
        summary: z.string().describe("2 sentences about the place"),
        whyForYou: z.string().describe("1 sentence tying it to the traveler's interests"),
        openingNote: z.string().describe("Opening hours / ticket situation for today's weekday, or 'Always open'"),
        anchor: z
          .enum(["first", "last", "none"])
          .catch("none")
          .describe("Use first/last only when timing really matters (e.g. sunset viewpoint = last); otherwise none"),
      }),
    )
    .describe("The stops to visit; the app computes the most efficient order itself"),
});
export type PlanOutput = z.infer<typeof PlanSchema>;

const narration = z.object({
  title: z.string(),
  script: z.string(),
  mood,
});

export const StopDetailsSchema = z.object({
  overview: z.array(z.string()).describe("2-3 paragraphs, rich and specific"),
  narration: narration.describe("Podcast-style audio script for the whole stop, ~150-170 words (about one minute)"),
  features: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().describe("2-4 sentences"),
        lookFor: z.string().describe("One concrete thing to spot in person"),
        imageSearch: z.string().describe("Search phrase for a Wikimedia Commons photo of this exact feature"),
        narration: narration.describe("Audio script for this feature, ~50-70 words (about 25 seconds)"),
      }),
    )
    .describe("3-5 interesting features of the place"),
  practical: z.object({
    hours: z.string(),
    tickets: z.string(),
    tip: z.string(),
  }),
  funFact: z.string(),
});
export type StopDetailsOutput = z.infer<typeof StopDetailsSchema>;

export const TodayIntroSchema = narration;

export const RestaurantPickSchema = z.object({
  slots: z.array(
    z.object({
      slotId: z.string(),
      restaurants: z.array(
        z.object({
          name: z.string(),
          cuisine: z.string(),
          rating: z.number().nullable().describe("Average traveler rating on a 5-point scale if found, else null"),
          reviewCount: z.number().nullable(),
          ratingSource: z.string().describe("Where the rating comes from, e.g. 'Google', 'Tripadvisor'"),
          priceLevel: z.string().describe("$, $$, $$$ or $$$$"),
          address: z.string(),
          lat: z.number().nullable(),
          lng: z.number().nullable(),
          why: z.string().describe("One sentence: what to order / why travelers love it"),
        }),
      ),
    }),
  ),
});
export type RestaurantPickOutput = z.infer<typeof RestaurantPickSchema>;
