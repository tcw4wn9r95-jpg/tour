"use client";
// Guide environment for the GitHub Pages build: calls Anthropic, the voice
// service and Google directly from the phone with the keys saved in Settings.
// Loaded lazily, so the server-hosted build never ships the Anthropic SDK to
// the browser.
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, type GuideEnv } from "../guide/env";
import { getDeviceKeys } from "./device-keys";

let cached: { signature: string; env: GuideEnv } | null = null;

export function deviceEnv(): GuideEnv {
  const keys = getDeviceKeys();
  const signature = JSON.stringify(keys);
  if (cached?.signature === signature) return cached.env;
  const env: GuideEnv = {
    // The key belongs to the person holding the phone; this header opts in to
    // browser calls, which Anthropic otherwise blocks to protect shared keys.
    claude: keys.anthropic ? new Anthropic({ apiKey: keys.anthropic, dangerouslyAllowBrowser: true, maxRetries: 2 }) : null,
    model: DEFAULT_MODEL,
    effort: "medium",
    tts: {
      elevenlabsKey: keys.elevenlabs || undefined,
      elevenlabsVoice: keys.elevenlabsVoice || undefined,
      elevenlabsStayFree: keys.elevenlabsFreeTier,
      openaiKey: keys.openai || undefined,
    },
    googlePlacesKey: keys.googlePlaces || undefined,
    // Google redirects this URL to the photo, so an <img> can load it directly.
    placePhotoUrl: (name) => `https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&key=${encodeURIComponent(keys.googlePlaces)}`,
  };
  cached = { signature, env };
  return env;
}

/** Cheap call that confirms the Anthropic key works (no tokens used). */
export async function checkAnthropicKey(apiKey: string): Promise<string | null> {
  try {
    await new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 0 }).models.retrieve(DEFAULT_MODEL);
    return null;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return "Anthropic rejected this key.";
    if (err instanceof Anthropic.PermissionDeniedError) return "This key can't use the Claude model the app needs.";
    if (err instanceof Anthropic.APIError) return `Couldn't verify the key (${err.status ?? "network error"}).`;
    return "Couldn't reach Anthropic — check your connection.";
  }
}
