import { z } from "zod/v4";
import { demoDetails } from "@/lib/demo";
import { StopDetailsSchema } from "@/lib/schemas";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { describeError, generateStructured, hasClaude } from "@/lib/server/claude";
import { DETAILS_SYSTEM, detailsPrompt } from "@/lib/server/prompts";
import { readJson } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

const Input = z.object({
  city: z.string().max(120),
  country: z.string().max(120),
  focus: z.array(z.string().max(40)).max(4),
  constraints: z.string().max(1000).default(""),
  weekday: z.string().max(20),
  stop: z.object({
    name: z.string().max(200),
    category: z.string().max(40),
    summary: z.string().max(2000),
    arriveAt: z.string().max(20).optional(),
    durationMin: z.number(),
  }),
});

export async function POST(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  const input = await readJson(req, Input);
  if (input instanceof Response) return input;

  if (!hasClaude()) return Response.json(demoDetails(input.stop.name));
  try {
    const details = await generateStructured(StopDetailsSchema, {
      system: DETAILS_SYSTEM,
      prompt: detailsPrompt(input),
      signal: req.signal,
    });
    return Response.json(details);
  } catch (err) {
    const { message, status } = describeError(err);
    return Response.json({ error: message }, { status });
  }
}
