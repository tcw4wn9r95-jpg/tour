import { haversine } from "../geo.ts";
import { CuriosityPickSchema } from "../schemas";
import type { Curiosity } from "../types";
import type { GuideEnv } from "./env";
import { CURIOSITY_SYSTEM, curiositiesPrompt, type CuriositiesInput } from "./prompts";
import { researchWithWebSearch } from "./research";

const MAX_ITEMS = 8;

const normalise = (url: string) => url.replace(/#.*$/, "").replace(/\/+$/, "").replace(/^http:/, "https:");

/** Quirky, overlooked things along the route, from travelers' forums. Every item cites a page the search returned. */
export async function forumCuriosities(env: GuideEnv, input: CuriositiesInput): Promise<Curiosity[]> {
  const { data, sources } = await researchWithWebSearch(env, {
    system: CURIOSITY_SYSTEM,
    prompt: curiositiesPrompt(input),
    tool: { name: "submit_curiosities", description: "Submit the curiosities found along the route. Call once, after researching." },
    schema: CuriosityPickSchema,
    maxSearches: 8,
    location: { city: input.city },
    failure: "Couldn't finish searching the forums. Try again in a moment.",
  });
  const seen = new Set([...sources].map(normalise));
  const ids = new Set(input.route.map((r) => r.id));
  const stops = input.route.filter((r) => r.id !== "start");

  return data.items
    .filter((c) => seen.has(normalise(c.sourceUrl))) // never show a source the search didn't return
    .map((c): Curiosity | null => {
      let nearStopId = c.nearStopId;
      if (!ids.has(nearStopId)) {
        // Unknown id: attach to the closest stop if we have coordinates.
        if (c.lat == null || c.lng == null || stops.length === 0) return null;
        nearStopId = stops.reduce((a, b) => (haversine(b, c as { lat: number; lng: number }) < haversine(a, c as { lat: number; lng: number }) ? b : a)).id;
      }
      return { ...c, id: "", nearStopId, onTheWay: c.onTheWay || nearStopId === "start" };
    })
    .filter((c): c is Curiosity => c !== null)
    .slice(0, MAX_ITEMS)
    .map((c, i) => ({ ...c, id: `c${i + 1}` }));
}
