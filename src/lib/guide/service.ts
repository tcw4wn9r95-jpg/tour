// The guide's features, independent of where they run: the API routes call
// these with server keys; the GitHub Pages build calls them on the phone.
import Anthropic from "@anthropic-ai/sdk";
import { DEMO_PLAN, demoDetails, demoRestaurants, demoTodayIntro } from "../demo";
import { PlanSchema, StopDetailsSchema, TodayIntroSchema, type PlanOutput, type StopDetailsOutput } from "../schemas";
import type { AppConfig, MealRecommendation, Narration, TourRequest } from "../types";
import { generateStructured, GuideError } from "./claude";
import { ttsProvider, type GuideEnv } from "./env";
import { DETAILS_SYSTEM, detailsPrompt, PLAN_SYSTEM, planPrompt, TODAY_SYSTEM, todayPrompt, type DetailsInput, type TodayInput } from "./prompts";
import { googleRestaurants, knowledgeRestaurants, webRestaurants, type RestaurantsRequest } from "./restaurants";
import { synthesize } from "./tts";

export type PlanProgress = { type: "status"; message: string } | { type: "stop"; name: string };

export function appConfig(env: GuideEnv): Omit<AppConfig, "passcodeRequired" | "keysOnDevice"> {
  return {
    claude: env.claude !== null,
    demo: env.claude === null,
    tts: ttsProvider(env.tts),
    restaurants: env.googlePlacesKey ? "google" : env.claude ? "web" : "demo",
    model: env.model,
  };
}

const NAME_RE = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

/** Plans the day; reports stop names as Claude writes them. */
export async function planTour(
  env: GuideEnv,
  req: TourRequest,
  onProgress: (e: PlanProgress) => void,
  signal?: AbortSignal,
): Promise<{ plan: PlanOutput; demo: boolean }> {
  if (!env.claude) {
    onProgress({ type: "status", message: "Demo mode — add an Anthropic API key to plan real tours. Here's a sample Lisbon day." });
    for (const s of DEMO_PLAN.stops) {
      await new Promise((r) => setTimeout(r, 250));
      onProgress({ type: "stop", name: s.name });
    }
    return { plan: DEMO_PLAN, demo: true };
  }
  onProgress({ type: "status", message: `Thinking about ${req.city} on a ${req.now.weekday}…` });
  const seen = new Set<string>();
  let scanned = 0;
  const plan = await generateStructured(env, PlanSchema, {
    system: PLAN_SYSTEM,
    prompt: planPrompt(req),
    signal,
    onText: (soFar) => {
      NAME_RE.lastIndex = Math.max(0, scanned - 300);
      for (const m of soFar.matchAll(NAME_RE)) {
        if (seen.has(m[1])) continue;
        try {
          onProgress({ type: "stop", name: JSON.parse(`"${m[1]}"`) });
          seen.add(m[1]);
        } catch {
          /* partial escape sequence; the next delta completes it */
        }
      }
      scanned = soFar.length;
    },
  });
  return { plan, demo: false };
}

export async function stopDetails(env: GuideEnv, input: DetailsInput, signal?: AbortSignal): Promise<StopDetailsOutput> {
  if (!env.claude) return demoDetails(input.stop.name);
  return generateStructured(env, StopDetailsSchema, { system: DETAILS_SYSTEM, prompt: detailsPrompt(input), signal });
}

export async function todayIntro(env: GuideEnv, input: TodayInput, signal?: AbortSignal): Promise<Narration> {
  if (!env.claude) return demoTodayIntro(input.stopNames);
  return generateStructured(env, TodayIntroSchema, { system: TODAY_SYSTEM, prompt: todayPrompt(input), maxTokens: 16000, signal });
}

export async function findRestaurants(env: GuideEnv, input: RestaurantsRequest): Promise<MealRecommendation[]> {
  if (input.slots.length === 0) return [];
  if (env.googlePlacesKey) {
    try {
      return await googleRestaurants(env, input);
    } catch (err) {
      // Fall through to web research if Places is misconfigured.
      console.error("Google Places failed", err);
      if (!env.claude) throw err;
    }
  }
  if (!env.claude) return demoRestaurants(input.slots);
  try {
    return await webRestaurants(env, input);
  } catch (err) {
    // e.g. web search not enabled for this organization
    if (!(err instanceof Anthropic.BadRequestError || err instanceof Anthropic.PermissionDeniedError)) throw err;
    console.warn("Web search unavailable, using Claude's own knowledge", err.message);
    return knowledgeRestaurants(env, input);
  }
}

/** MP3 narration from the configured voice service. */
export async function speak(env: GuideEnv, text: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (ttsProvider(env.tts) === "browser") throw new GuideError("No voice service configured", 501);
  return synthesize(env.tts, text, signal);
}
