import { z } from "zod/v4";
import { demoTodayIntro } from "@/lib/demo";
import { TodayIntroSchema } from "@/lib/schemas";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { describeError, generateStructured, hasClaude } from "@/lib/server/claude";
import { TODAY_SYSTEM, todayPrompt } from "@/lib/server/prompts";
import { readJson } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

const Input = z.object({
  city: z.string().max(120),
  title: z.string().max(200),
  focus: z.array(z.string().max(40)).max(4),
  focusNotes: z.string().max(500).optional(),
  constraints: z.string().max(1000).default(""),
  timeAvailable: z.string().max(200),
  weekday: z.string().max(20),
  itinerary: z.array(z.string().max(400)).max(30),
  stopNames: z.array(z.string().max(200)).max(20),
});

export async function POST(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  const input = await readJson(req, Input);
  if (input instanceof Response) return input;

  if (!hasClaude()) return Response.json(demoTodayIntro(input.stopNames));
  try {
    const narration = await generateStructured(TodayIntroSchema, {
      system: TODAY_SYSTEM,
      prompt: todayPrompt(input),
      maxTokens: 16000,
      signal: req.signal,
    });
    return Response.json(narration);
  } catch (err) {
    const { message, status } = describeError(err);
    return Response.json({ error: message }, { status });
  }
}
