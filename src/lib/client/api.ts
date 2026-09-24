"use client";
// How the app reaches the guide. Server-hosted builds call the API routes; the
// GitHub Pages build (NEXT_PUBLIC_STATIC_EXPORT=1) has no server, so it runs the
// same guide code right here with the keys saved in Settings.
import type { CuriositiesInput, DetailsInput, TodayInput } from "../guide/prompts";
import type { RestaurantsRequest } from "../guide/restaurants";
import type { PlanProgress } from "../guide/service";
import type { VoicePriority, VoiceUsage } from "../guide/voice-budget";
import type { StopContent } from "../schemas";
import type { AppConfig, Curiosity, MealRecommendation, Narration, RawPlan, TourRequest } from "../types";

export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";
/** Path prefix when served from a sub-path, e.g. "/tour" on GitHub Pages. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const PASSCODE_KEY = "citytour.passcode";

export function getPasscode(): string {
  try {
    return localStorage.getItem(PASSCODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setPasscode(value: string) {
  try {
    localStorage.setItem(PASSCODE_KEY, value);
  } catch {
    /* private mode */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

// --- Server-hosted build ------------------------------------------------------

function headers(): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  const code = getPasscode();
  if (code) h["x-app-passcode"] = code;
  return h;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body), signal });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code);
  }
  return (await res.json()) as T;
}

/** Appends the passcode to the server's photo proxy URLs used in <img src>. */
export function withPasscode(url: string | undefined): string | undefined {
  if (!url || !url.includes("/api/place-photo")) return url;
  const code = getPasscode();
  return code ? `${url}${url.includes("?") ? "&" : "?"}k=${encodeURIComponent(code)}` : url;
}

// --- GitHub Pages build: the guide runs on the phone --------------------------------

async function onDevice<T>(
  run: (env: import("../guide/env").GuideEnv, guide: typeof import("../guide/service")) => Promise<T>,
): Promise<T> {
  const [{ deviceEnv }, guide, { describeError }] = await Promise.all([
    import("./device-env"),
    import("../guide/service"),
    import("../guide/claude"),
  ]);
  try {
    return await run(deviceEnv(), guide);
  } catch (err) {
    const { message, status, code } = describeError(err);
    throw new ApiError(message, status, code);
  }
}

// --- Public API ---------------------------------------------------------------

export type AppConfigResponse = AppConfig & { passcodeOk: boolean };

let configPromise: Promise<AppConfigResponse> | null = null;
const configListeners = new Set<(c: AppConfigResponse) => void>();

export function onConfigChange(listener: (c: AppConfigResponse) => void): () => void {
  configListeners.add(listener);
  return () => configListeners.delete(listener);
}

export function loadConfig(force = false): Promise<AppConfigResponse> {
  if (!configPromise || force) {
    const load: Promise<AppConfigResponse> = IS_STATIC
      ? onDevice(async (env, guide) => ({ ...guide.appConfig(env), passcodeRequired: false, passcodeOk: true, keysOnDevice: true }))
      : fetch(`${BASE}/api/config`, { headers: headers(), cache: "no-store" }).then((r) => r.json() as Promise<AppConfigResponse>);
    configPromise = load.then(
      (c) => {
        for (const l of configListeners) l(c);
        return c;
      },
      (err) => {
        configPromise = null;
        throw err;
      },
    );
  }
  return configPromise;
}

/** Plans a tour, reporting progress (stops appear as Claude writes them). */
export async function requestPlan(
  request: TourRequest,
  onEvent: (e: PlanProgress) => void,
  signal?: AbortSignal,
): Promise<{ plan: RawPlan; demo: boolean }> {
  if (IS_STATIC) {
    return onDevice(async (env, guide) => {
      const { plan, demo } = await guide.planTour(env, request, onEvent, signal);
      return { plan: plan as RawPlan, demo };
    });
  }
  const res = await fetch(`${BASE}/api/plan`, { method: "POST", headers: headers(), body: JSON.stringify(request), signal });
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(data.error ?? `Planning failed (${res.status})`, res.status, data.code);
  }
  type StreamEvent = PlanProgress | { type: "plan"; plan: RawPlan; demo?: boolean } | { type: "error"; message: string } | { type: "ping" };
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "plan") return { plan: event.plan, demo: Boolean(event.demo) };
      if (event.type === "error") throw new ApiError(event.message, 500);
      if (event.type !== "ping") onEvent(event);
    }
    if (done) break;
  }
  throw new ApiError("The connection closed before the plan was ready. Please try again.", 500);
}

export const fetchStopDetails = (body: DetailsInput, signal?: AbortSignal): Promise<StopContent> =>
  IS_STATIC ? onDevice((env, guide) => guide.stopDetails(env, body, signal)) : post("/api/stop-details", body, signal);

export const fetchTodayIntro = (body: TodayInput, signal?: AbortSignal): Promise<Narration> =>
  IS_STATIC ? onDevice((env, guide) => guide.todayIntro(env, body, signal)) : post("/api/today-intro", body, signal);

export const fetchRestaurants = (body: RestaurantsRequest, signal?: AbortSignal): Promise<MealRecommendation[]> =>
  IS_STATIC ? onDevice((env, guide) => guide.findRestaurants(env, body)) : post("/api/restaurants", body, signal);

export const fetchCuriosities = (body: CuriositiesInput, signal?: AbortSignal): Promise<Curiosity[]> =>
  IS_STATIC ? onDevice((env, guide) => guide.findCuriosities(env, body)) : post("/api/curiosities", body, signal);

/** MP3 narration. Throws ApiError code "voice-budget" when ElevenLabs credits must be saved. */
export async function fetchSpeech(text: string, priority: VoicePriority, signal?: AbortSignal): Promise<Blob> {
  if (IS_STATIC) {
    const mp3 = await onDevice((env, guide) => guide.speak(env, text, priority, signal));
    return new Blob([mp3], { type: "audio/mpeg" });
  }
  const res = await fetch(`${BASE}/api/tts`, { method: "POST", headers: headers(), body: JSON.stringify({ text, priority }), signal });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(data.error ?? "Voice unavailable", res.status, data.code);
  }
  return res.blob();
}

/** ElevenLabs credits used this month vs. the app's budget (null when not using ElevenLabs). */
export async function fetchVoiceUsage(): Promise<VoiceUsage | null> {
  if (IS_STATIC) return onDevice((env, guide) => guide.voiceUsage(env));
  const res = await fetch(`${BASE}/api/voice-usage`, { headers: headers(), cache: "no-store" });
  return res.ok ? ((await res.json()) as VoiceUsage | null) : null;
}
