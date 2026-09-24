import { z } from "zod/v4";
import { describeError } from "@/lib/guide/claude";
import { stopDetails } from "@/lib/guide/service";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { serverEnv } from "@/lib/server/env";
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

  try {
    return Response.json(await stopDetails(serverEnv(), input, req.signal));
  } catch (err) {
    const { message, status } = describeError(err);
    return Response.json({ error: message }, { status });
  }
}
