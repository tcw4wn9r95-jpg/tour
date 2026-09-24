import "server-only";
import { z } from "zod/v4";

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const TourRequestInput = z.object({
  city: z.string().trim().min(1).max(120),
  focus: z.array(z.enum(["food", "architecture", "history", "everything"])).min(1).max(4),
  focusNotes: z.string().max(500).optional(),
  timeAvailable: z.string().trim().min(1).max(200),
  transport: z.enum(["transit", "car"]),
  constraints: z.string().max(1000).default(""),
  now: z.object({
    iso: z.string().max(40),
    weekday: z.string().max(20),
    date: z.string().max(40),
    time: z.string().max(20),
    timeZone: z.string().max(60),
    utcOffsetMinutes: z.number(),
  }),
  userLocation: latLng.optional(),
});

export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S> | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  return parsed.data;
}
