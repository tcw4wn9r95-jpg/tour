"use client";
import type { AppConfig, MealRecommendation, Narration, RawPlan, TourRequest } from "../types";
import type { StopDetailsOutput } from "../schemas";

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

function headers(): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  const code = getPasscode();
  if (code) h["x-app-passcode"] = code;
  return h;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body), signal });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code);
  }
  return (await res.json()) as T;
}

/** Appends the passcode to same-origin API URLs used in <img src>. */
export function withPasscode(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("/api/")) return url;
  const code = getPasscode();
  return code ? `${url}${url.includes("?") ? "&" : "?"}k=${encodeURIComponent(code)}` : url;
}

export type AppConfigResponse = AppConfig & { passcodeOk: boolean };

let configPromise: Promise<AppConfigResponse> | null = null;

export function loadConfig(force = false): Promise<AppConfigResponse> {
  if (!configPromise || force) {
    configPromise = fetch("/api/config", { headers: headers(), cache: "no-store" })
      .then((r) => r.json() as Promise<AppConfigResponse>)
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

export type PlanEvent =
  | { type: "status"; message: string }
  | { type: "stop"; name: string }
  | { type: "plan"; plan: RawPlan; demo?: boolean }
  | { type: "error"; message: string }
  | { type: "ping" };

/** Streams plan progress events; resolves with the raw plan. */
export async function requestPlan(
  request: TourRequest,
  onEvent: (e: PlanEvent) => void,
  signal?: AbortSignal,
): Promise<{ plan: RawPlan; demo: boolean }> {
  const res = await fetch("/api/plan", { method: "POST", headers: headers(), body: JSON.stringify(request), signal });
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(data.error ?? `Planning failed (${res.status})`, res.status, data.code);
  }
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
      const event = JSON.parse(line) as PlanEvent;
      if (event.type === "plan") return { plan: event.plan, demo: Boolean(event.demo) };
      if (event.type === "error") throw new ApiError(event.message, 500);
      onEvent(event);
    }
    if (done) break;
  }
  throw new ApiError("The connection closed before the plan was ready. Please try again.", 500);
}

export const fetchStopDetails = (body: unknown, signal?: AbortSignal) =>
  post<StopDetailsOutput>("/api/stop-details", body, signal);

export const fetchTodayIntro = (body: unknown, signal?: AbortSignal) => post<Narration>("/api/today-intro", body, signal);

export const fetchRestaurants = (body: unknown, signal?: AbortSignal) =>
  post<MealRecommendation[]>("/api/restaurants", body, signal);

export async function fetchSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch("/api/tts", { method: "POST", headers: headers(), body: JSON.stringify({ text }), signal });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(data.error ?? "Voice unavailable", res.status, data.code);
  }
  return res.blob();
}
