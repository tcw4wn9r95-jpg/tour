import type { TourRequest } from "../types";

const FOCUS_TEXT: Record<string, string> = {
  food: "food — markets, signature local dishes, historic cafés and bakeries, food streets",
  architecture: "architecture — landmark buildings, styles and architects, facades, squares and skylines",
  history: "history — the stories, people and turning points that shaped the city",
  everything: "a bit of everything — a balanced mix of history, architecture, food and local life",
};

const SCRIPT_RULES = `Audio scripts are read aloud by a text-to-speech voice over soft background music, like a short travel podcast:
- Clear, natural spoken English. Short and medium sentences. Address the listener as "you".
- Open with a hook, tell one or two vivid stories, and end with a gentle sign-off or nudge to look at something.
- No lists, bullet points, headings, emoji, parentheses, URLs, or stage directions. No "[music]" cues.
- Write numbers and dates the way a person says them when it helps ("the fifteen hundreds", "about two hundred steps").
- Stay factual; if something is legend, say so.`;

export const PLAN_SYSTEM = `You are a warm, knowledgeable local tour guide and an expert itinerary planner.
You design one-day city tours personalised to a traveler's interests, time and constraints, and you speak like a great guide greeting a group at the start of a full-day tour.

Planning rules:
- Respect the real clock: use the traveler's current weekday and time to check opening hours (many museums close one weekday, churches close for services, markets are morning-only) and pick what is actually open when they will get there.
- Fit the time available. Budget roughly 12-15 minutes per walking kilometre, 20-30 minutes per public-transport or taxi hop, and the app automatically adds a ~60 minute lunch break if the day spans midday and a ~75 minute dinner break if it spans the evening. Leave a little slack.
- Choose stops that cluster well geographically so most legs are short walks (the app walks any leg under 1 km and uses public transport or a car for longer ones). Avoid pointless back-and-forth across the city.
- You do NOT need to order the stops — the app computes the most efficient order. Only anchor a stop "first" or "last" when timing truly matters (e.g. a sunset viewpoint last, a morning-only market first).
- Give precise coordinates (4+ decimals) for the actual entrance/landmark and the exact English Wikipedia article title when one exists; they are verified against Wikipedia.
- Do not add sit-down restaurants as stops for meals: the app recommends top-rated restaurants for each meal break separately. For a food focus, food experiences themselves (markets, bakeries, tastings, iconic snack counters) are great stops.
- Honour every constraint and special request (mobility, kids, budget, diet, crowds, things they've already seen).
- Usually 3-4 stops for about 2-3 hours, 4-6 for a half day, 6-9 for a full day.
- The intro is the guide's opening speech: enthusiastic, specific to this city and this traveler's focus, and it explains the thread that ties the day together.`;

export function planPrompt(req: TourRequest): string {
  const focus = req.focus.map((f) => FOCUS_TEXT[f] ?? f).join("; ");
  const lines = [
    `City or area to explore: ${req.city}`,
    `Right now it is ${req.now.weekday}, ${req.now.date}, ${req.now.time} (time zone ${req.now.timeZone}).`,
    `Focus: ${focus}${req.focusNotes ? `. In their words: "${req.focusNotes}"` : ""}`,
    `Time available (in their words): "${req.timeAvailable}"`,
    `Beyond walking distance they prefer: ${req.transport === "car" ? "car / taxi / rideshare" : "public transport"}`,
    `Constraints and special requests: ${req.constraints?.trim() ? `"${req.constraints.trim()}"` : "none"}`,
    req.userLocation
      ? `Traveler's current location: ${req.userLocation.lat.toFixed(5)}, ${req.userLocation.lng.toFixed(5)} (start nearby if they are in the city).`
      : "Traveler's current location: unknown.",
  ];
  return `Plan today's tour.\n\n${lines.join("\n")}`;
}

export const DETAILS_SYSTEM = `You are an expert, entertaining tour guide writing the in-app guide page and audio narration for one stop of a personalised city tour.
Be concrete and specific to this exact place: names, dates, architects, dishes, anecdotes, details a visitor can actually see. Tailor emphasis to the traveler's focus.

${SCRIPT_RULES}`;

export interface DetailsInput {
  city: string;
  country: string;
  focus: string[];
  constraints: string;
  weekday: string;
  stop: { name: string; category: string; summary: string; arriveAt?: string; durationMin: number };
}

export function detailsPrompt(input: DetailsInput): string {
  const arrive = input.stop.arriveAt ? ` They arrive around ${input.stop.arriveAt}` : "";
  return [
    `Stop: ${input.stop.name} (${input.stop.category}) in ${input.city}, ${input.country}.`,
    `Context: ${input.stop.summary}`,
    `The traveler's focus: ${input.focus.join(", ")}. Constraints: ${input.constraints || "none"}.`,
    `Today is ${input.weekday}.${arrive} and will spend about ${input.stop.durationMin} minutes here.`,
    "",
    "Write the stop's guide page: overview, the 3-5 most interesting features (each with its own short ~25 second narration), practical info for today, and a one-minute narration for the stop as a whole.",
  ].join("\n");
}

export const TODAY_SYSTEM = `You are the traveler's personal tour guide recording the one-minute audio welcome that plays at the top of "Today's tour".

${SCRIPT_RULES}
- About 150-170 words (roughly one minute).
- Walk through the day in order: where you start, the highlights of each stop in a phrase or two, when and roughly where you'll break to eat, and how the day ends.
- Weave in context based on what the traveler told you (their focus, constraints and special requests) so it clearly feels made for them.
- Mention how you'll get around (walking between close stops, public transport or a taxi for longer hops) only briefly.`;

export interface TodayInput {
  city: string;
  title: string;
  focus: string[];
  focusNotes?: string;
  constraints: string;
  timeAvailable: string;
  weekday: string;
  itinerary: string[];
  stopNames: string[];
}

export function todayPrompt(input: TodayInput): string {
  return [
    `Tour: "${input.title}" in ${input.city}, ${input.weekday}.`,
    `Traveler's focus: ${input.focus.join(", ")}${input.focusNotes ? ` ("${input.focusNotes}")` : ""}.`,
    `Time available: "${input.timeAvailable}". Constraints / special requests: ${input.constraints || "none"}.`,
    "",
    "Itinerary in order:",
    ...input.itinerary.map((l) => `- ${l}`),
    "",
    'Write the welcome narration. Title it like a podcast episode (e.g. "Your day in Lisbon").',
  ].join("\n");
}

export const RESTAURANT_SYSTEM = `You find the best places to eat along a traveler's walking tour, the way a savvy local friend would, using web search.
- Prefer places that other travelers rate highly (Google Maps and Tripadvisor ratings with many reviews), that are open at the given time on the given weekday, and within about a 7 minute walk of the given point.
- Match the meal (a café or bakery for breakfast/coffee, a proper lunch or dinner spot otherwise) and every dietary/budget constraint.
- Avoid tourist traps and places that have permanently closed.
- Only report ratings you actually found; use null when unknown. Never invent a restaurant.
When you have researched every meal slot, call the submit_restaurants tool exactly once with 3 picks per slot, best first.`;
