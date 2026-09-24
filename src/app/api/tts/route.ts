import { z } from "zod/v4";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { synthesize, ttsProvider } from "@/lib/server/tts";
import { readJson } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 120;

const Input = z.object({ text: z.string().trim().min(1).max(4000) });

export async function POST(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  const input = await readJson(req, Input);
  if (input instanceof Response) return input;

  if (ttsProvider() === "browser") {
    return Response.json({ error: "No server voice configured", code: "browser-tts" }, { status: 501 });
  }
  try {
    const audio = await synthesize(input.text, req.signal);
    return new Response(audio, {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=31536000, immutable" },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "The voice service failed. Using the phone's voice instead.", code: "tts-failed" }, { status: 502 });
  }
}
