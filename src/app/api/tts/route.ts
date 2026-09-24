import { z } from "zod/v4";
import { describeError } from "@/lib/guide/claude";
import { speak } from "@/lib/guide/service";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { serverEnv } from "@/lib/server/env";
import { readJson } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 120;

const Input = z.object({ text: z.string().trim().min(1).max(4000), priority: z.enum(["main", "extra"]).default("main") });

export async function POST(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  const input = await readJson(req, Input);
  if (input instanceof Response) return input;

  try {
    const audio = await speak(serverEnv(), input.text, input.priority, req.signal);
    return new Response(audio, {
      headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=31536000, immutable" },
    });
  } catch (err) {
    const { message, status, code } = describeError(err);
    if (!code) console.error(err);
    // The phone falls back to its built-in voice on any error.
    return Response.json({ error: code ? message : "The voice service failed. Using the phone's voice instead.", code: code ?? "tts-failed" }, { status: code ? status : 502 });
  }
}
