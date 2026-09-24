// Everything the guide needs to talk to outside services. Built from server
// environment variables (src/lib/server/env.ts) or, in the GitHub Pages build,
// from keys saved on the phone (src/lib/client/device-env.ts).
import type Anthropic from "@anthropic-ai/sdk";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type TtsProvider = "elevenlabs" | "openai" | "browser";

export const DEFAULT_MODEL = "claude-opus-5";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

export function parseEffort(value: string | undefined): Effort {
  return EFFORTS.includes(value as Effort) ? (value as Effort) : "medium";
}

export interface TtsKeys {
  elevenlabsKey?: string;
  elevenlabsVoice?: string;
  elevenlabsModel?: string;
  openaiKey?: string;
  openaiVoice?: string;
  openaiModel?: string;
}

export interface GuideEnv {
  /** null = no Anthropic key: the guide serves the sample Lisbon tour. */
  claude: Anthropic | null;
  model: string;
  effort: Effort;
  tts: TtsKeys;
  googlePlacesKey?: string;
  /** URL an <img> can load for a Google Places photo resource name. */
  placePhotoUrl: (photoName: string) => string;
}

export function ttsProvider(tts: TtsKeys): TtsProvider {
  if (tts.elevenlabsKey) return "elevenlabs";
  if (tts.openaiKey) return "openai";
  return "browser";
}
