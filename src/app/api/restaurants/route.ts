import { z } from "zod/v4";
import { demoRestaurants } from "@/lib/demo";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import Anthropic from "@anthropic-ai/sdk";
import { describeError, hasClaude } from "@/lib/server/claude";
import { googleRestaurants, knowledgeRestaurants, webRestaurants } from "@/lib/server/restaurants";
import { readJson } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

const Input = z.object({
  city: z.string().max(120),
  country: z.string().max(120),
  timeZone: z.string().max(60),
  constraints: z.string().max(1000).default(""),
  slots: z
    .array(
      z.object({
        slotId: z.string().max(40),
        kind: z.enum(["breakfast", "lunch", "coffee", "dinner"]),
        lat: z.number(),
        lng: z.number(),
        nearName: z.string().max(200),
        localTime: z.string().regex(/^\d{2}:\d{2}$/),
        weekday: z.number().int().min(0).max(6),
        weekdayName: z.string().max(20),
      }),
    )
    .max(5),
});

export async function POST(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  const input = await readJson(req, Input);
  if (input instanceof Response) return input;
  if (input.slots.length === 0) return Response.json([]);

  try {
    if (process.env.GOOGLE_PLACES_API_KEY) {
      try {
        return Response.json(await googleRestaurants(input));
      } catch (err) {
        // Fall through to web research if Places is misconfigured.
        console.error("Google Places failed", err);
        if (!hasClaude()) throw err;
      }
    }
    if (!hasClaude()) return Response.json(demoRestaurants(input.slots));
    try {
      return Response.json(await webRestaurants(input));
    } catch (err) {
      // e.g. web search not enabled for this organization
      if (!(err instanceof Anthropic.BadRequestError || err instanceof Anthropic.PermissionDeniedError)) throw err;
      console.warn("Web search unavailable, using Claude's own knowledge", err.message);
      return Response.json(await knowledgeRestaurants(input));
    }
  } catch (err) {
    const { message, status } = describeError(err);
    return Response.json({ error: message }, { status });
  }
}
