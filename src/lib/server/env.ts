import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, parseEffort, type GuideEnv } from "../guide/env";

let env: GuideEnv | null = null;

/** Guide environment for the API routes, from the server's environment variables. */
export function serverEnv(): GuideEnv {
  if (env) return env;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  env = {
    claude: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? new Anthropic({ maxRetries: 2 }) : null,
    model: process.env.TOUR_CLAUDE_MODEL || DEFAULT_MODEL,
    effort: parseEffort(process.env.TOUR_CLAUDE_EFFORT),
    tts: {
      elevenlabsKey: process.env.ELEVENLABS_API_KEY,
      elevenlabsVoice: process.env.ELEVENLABS_VOICE_ID,
      elevenlabsModel: process.env.ELEVENLABS_MODEL,
      openaiKey: process.env.OPENAI_API_KEY,
      openaiVoice: process.env.OPENAI_TTS_VOICE,
      openaiModel: process.env.OPENAI_TTS_MODEL,
    },
    googlePlacesKey: process.env.GOOGLE_PLACES_API_KEY,
    // Proxied so the Places key never reaches the phone.
    placePhotoUrl: (name) => `${base}/api/place-photo?name=${encodeURIComponent(name)}`,
  };
  return env;
}
