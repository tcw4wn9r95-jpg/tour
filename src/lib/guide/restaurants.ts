import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { haversine } from "../geo.ts";
import { RestaurantPickSchema } from "../schemas";
import type { MealKind, MealRecommendation, Restaurant } from "../types";
import { generateStructured, GuideError, withFallbacks } from "./claude";
import type { GuideEnv } from "./env";
import { RESTAURANT_SYSTEM } from "./prompts";

export interface MealQuery {
  slotId: string;
  kind: MealKind;
  lat: number;
  lng: number;
  nearName: string;
  /** Local wall-clock time of the meal, "13:05". */
  localTime: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  weekdayName: string;
}

export interface RestaurantsRequest {
  city: string;
  country: string;
  timeZone: string;
  constraints: string;
  slots: MealQuery[];
}

const PICKS_PER_SLOT = 3;

// ---------------------------------------------------------------------------
// Google Places (real traveler ratings)

const PLACE_TYPES: Record<MealKind, string[]> = {
  breakfast: ["breakfast_restaurant", "brunch_restaurant", "cafe", "bakery"],
  coffee: ["cafe", "coffee_shop", "bakery"],
  lunch: ["restaurant"],
  dinner: ["restaurant"],
};

const PRICE: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  shortFormattedAddress?: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryTypeDisplayName?: { text: string };
  googleMapsUri?: string;
  photos?: { name: string }[];
  editorialSummary?: { text: string };
  regularOpeningHours?: { periods?: { open: DayTime; close?: DayTime }[] };
  servesVegetarianFood?: boolean;
  businessStatus?: string;
}
interface DayTime {
  day: number;
  hour: number;
  minute: number;
}

const FIELDS = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.shortFormattedAddress",
  "places.formattedAddress",
  "places.location",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
  "places.photos",
  "places.editorialSummary",
  "places.regularOpeningHours",
  "places.servesVegetarianFood",
  "places.businessStatus",
].join(",");

function openAt(place: GooglePlace, weekday: number, localTime: string): boolean | null {
  const periods = place.regularOpeningHours?.periods;
  if (!periods?.length) return null;
  const [h, m] = localTime.split(":").map(Number);
  const WEEK = 7 * 1440;
  const t = weekday * 1440 + h * 60 + m;
  return periods.some(({ open, close }) => {
    if (!close) return true; // open 24 hours
    const o = open.day * 1440 + open.hour * 60 + open.minute;
    let c = close.day * 1440 + close.hour * 60 + close.minute;
    if (c <= o) c += WEEK;
    // stay open for at least 45 minutes after arrival
    return [t, t + WEEK].some((x) => x >= o && x + 45 <= c);
  });
}

/** Rating that trusts 4.8 from 2,000 reviews more than 5.0 from 6. */
function weightedRating(rating: number, count: number): number {
  const prior = 4.2;
  const m = 150;
  return (count / (count + m)) * rating + (m / (count + m)) * prior;
}

async function googleSlot(env: GuideEnv, req: RestaurantsRequest, slot: MealQuery): Promise<MealRecommendation> {
  const key = env.googlePlacesKey!;
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
    body: JSON.stringify({
      includedTypes: PLACE_TYPES[slot.kind],
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      locationRestriction: { circle: { center: { latitude: slot.lat, longitude: slot.lng }, radius: 650 } },
    }),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { places?: GooglePlace[] };
  const veggie = /vegetarian|vegan|plant/i.test(req.constraints);

  const candidates = (data.places ?? [])
    .filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY" && p.rating && (p.userRatingCount ?? 0) >= 25)
    .filter((p) => !veggie || p.servesVegetarianFood !== false)
    .map((p) => ({ p, open: openAt(p, slot.weekday, slot.localTime) }))
    .filter(({ open }) => open !== false)
    .sort((a, b) => weightedRating(b.p.rating!, b.p.userRatingCount!) - weightedRating(a.p.rating!, a.p.userRatingCount!))
    .slice(0, PICKS_PER_SLOT + 1);

  const restaurants: Restaurant[] = candidates.map(({ p, open }) => {
    const lat = p.location?.latitude ?? null;
    const lng = p.location?.longitude ?? null;
    return {
      name: p.displayName?.text ?? "Restaurant",
      cuisine: p.primaryTypeDisplayName?.text ?? "Restaurant",
      rating: p.rating ?? null,
      reviewCount: p.userRatingCount ?? null,
      ratingSource: "Google",
      priceLevel: p.priceLevel ? (PRICE[p.priceLevel] ?? "") : "",
      address: p.shortFormattedAddress ?? p.formattedAddress ?? "",
      lat,
      lng,
      distanceM: lat != null && lng != null ? Math.round(haversine(slot, { lat, lng })) : null,
      why: p.editorialSummary?.text ?? "",
      mapsUrl: p.googleMapsUri ?? "",
      photoUrl: p.photos?.[0] ? env.placePhotoUrl(p.photos[0].name) : undefined,
      openNow: open,
    };
  });
  return { slotId: slot.slotId, kind: slot.kind, restaurants, source: "google" };
}

export async function googleRestaurants(env: GuideEnv, req: RestaurantsRequest): Promise<MealRecommendation[]> {
  return Promise.all(req.slots.map((slot) => googleSlot(env, req, slot)));
}

// ---------------------------------------------------------------------------
// Claude + web search (no extra API key needed)

const slotLines = (req: RestaurantsRequest) =>
  req.slots.map(
    (s) =>
      `- slotId "${s.slotId}": ${s.kind} at ${s.localTime} on ${s.weekdayName}, near ${s.nearName} (${s.lat.toFixed(5)}, ${s.lng.toFixed(5)})`,
  );

const pickFormat = betaZodOutputFormat(RestaurantPickSchema);

export async function webRestaurants(env: GuideEnv, req: RestaurantsRequest): Promise<MealRecommendation[]> {
  const submitTool: Anthropic.Beta.Messages.BetaTool = {
    name: "submit_restaurants",
    description: "Submit the final restaurant picks for every meal slot. Call once, after researching.",
    strict: true,
    input_schema: pickFormat.schema as Anthropic.Beta.Messages.BetaTool.InputSchema,
  };
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        `City: ${req.city}, ${req.country}.`,
        `Dietary / budget constraints: ${req.constraints || "none"}.`,
        "Meal slots along the route:",
        ...slotLines(req),
        "",
        `Find ${PICKS_PER_SLOT} top-rated places for each slot, then call submit_restaurants.`,
      ].join("\n"),
    },
  ];

  for (let turn = 0; turn < 6; turn++) {
    const message = await withFallbacks(
      env,
      {
        model: env.model,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: env.effort },
        system: RESTAURANT_SYSTEM,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", city: req.city, timezone: req.timeZone } },
          submitTool,
        ],
        messages,
      },
      (client, p) => client.beta.messages.stream(p).finalMessage(),
    );

    if (message.stop_reason === "refusal") throw new GuideError("Claude couldn't research restaurants for this route.", 422);

    const call = message.content.find(
      (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use" && b.name === "submit_restaurants",
    );
    if (call) {
      const parsed = RestaurantPickSchema.safeParse(call.input);
      if (parsed.success) return toRecommendations(req, parsed.data, "web");
      messages.push({ role: "assistant", content: message.content });
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: "Input did not match the schema; please resubmit." }],
      });
      continue;
    }
    messages.push({ role: "assistant", content: message.content });
    if (message.stop_reason === "pause_turn") continue; // long web research; let it resume
    messages.push({ role: "user", content: "Please call submit_restaurants now with your picks." });
  }
  throw new GuideError("Couldn't finish the restaurant research. Try again in a moment.");
}

/** Last resort when web search isn't enabled for the API key's organization. */
export async function knowledgeRestaurants(env: GuideEnv, req: RestaurantsRequest): Promise<MealRecommendation[]> {
  const data = await generateStructured(env, RestaurantPickSchema, {
    system:
      "You recommend long-established, highly rated places to eat near a point on a traveler's route, from your own knowledge. " +
      "Only suggest places you are confident exist and are well reviewed; give ratings only if you know them, else null.",
    prompt: [
      `City: ${req.city}, ${req.country}. Constraints: ${req.constraints || "none"}.`,
      "Meal slots:",
      ...slotLines(req),
      `Give ${PICKS_PER_SLOT} picks per slot, best first.`,
    ].join("\n"),
    maxTokens: 16000,
  });
  return toRecommendations(req, data, "claude").map((r) => ({ ...r, note: "From your guide's knowledge — check opening hours before you go." }));
}

function toRecommendations(
  req: RestaurantsRequest,
  data: { slots: { slotId: string; restaurants: Omit<Restaurant, "distanceM" | "mapsUrl">[] }[] },
  source: MealRecommendation["source"],
): MealRecommendation[] {
  return req.slots.map((slot) => {
    const picks = data.slots.find((s) => s.slotId === slot.slotId)?.restaurants ?? [];
    return {
      slotId: slot.slotId,
      kind: slot.kind,
      source,
      restaurants: picks.slice(0, PICKS_PER_SLOT).map((r) => ({
        ...r,
        distanceM: r.lat != null && r.lng != null ? Math.round(haversine(slot, { lat: r.lat, lng: r.lng })) : null,
        mapsUrl: `https://maps.apple.com/?${new URLSearchParams({ q: `${r.name}, ${r.address || req.city}` })}`,
      })),
    };
  });
}
