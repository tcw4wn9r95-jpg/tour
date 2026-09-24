import { z } from "zod/v4";
import { describeError } from "@/lib/guide/claude";
import { findCuriosities } from "@/lib/guide/service";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { serverEnv } from "@/lib/server/env";
import { readJson } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

const Input = z.object({
  city: z.string().max(120),
  country: z.string().max(120),
  focus: z.array(z.string().max(40)).max(4),
  route: z
    .array(
      z.object({
        id: z.string().max(20),
        name: z.string().max(200),
        lat: z.number(),
        lng: z.number(),
        legTo: z.string().max(80).optional(),
      }),
    )
    .max(25),
});

export async function POST(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  const input = await readJson(req, Input);
  if (input instanceof Response) return input;
  try {
    return Response.json(await findCuriosities(serverEnv(), input));
  } catch (err) {
    const { message, status } = describeError(err);
    return Response.json({ error: message }, { status });
  }
}
