import { z } from "zod/v4";
import { describeError } from "@/lib/guide/claude";
import { findRestaurants } from "@/lib/guide/service";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { serverEnv } from "@/lib/server/env";
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
  try {
    return Response.json(await findRestaurants(serverEnv(), input));
  } catch (err) {
    const { message, status } = describeError(err);
    return Response.json({ error: message }, { status });
  }
}
