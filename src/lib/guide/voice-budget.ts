// Keeps ElevenLabs narration within a monthly credit budget (by default the
// free plan's 10,000 credits). Before each clip we check the account's live
// usage; when a clip wouldn't fit, the app reads it with the phone's built-in
// voice instead, which costs nothing.

export const FREE_TIER_CREDITS = 10_000;
/** Credits held back for the main one-minute stories; feature clips can't dip into them. */
export const MAIN_STORY_RESERVE = 2_500;
/** Headroom for usage ElevenLabs hasn't reported yet. */
const SAFETY_MARGIN = 150;
const USAGE_TTL_MS = 60_000;

export const DEFAULT_ELEVENLABS_MODEL = "eleven_flash_v2_5";

/** "main": today's welcome and each stop's story. "extra": the per-highlight clips. */
export type VoicePriority = "main" | "extra";

export interface VoiceUsage {
  used: number;
  /** The account's own monthly limit. */
  limit: number;
  /** What the app allows itself to use this month. */
  budget: number;
  resetsAt: number | null; // unix ms
  tier: string;
}

/** Flash and Turbo models cost half a credit per character; the others one. */
export function creditsPerChar(model: string): number {
  return /flash|turbo/i.test(model) ? 0.5 : 1;
}

export function clipCost(text: string, model: string): number {
  return Math.ceil(text.length * creditsPerChar(model));
}

export function budgetOf(limit: number, stayFree: boolean): number {
  return stayFree ? Math.min(limit, FREE_TIER_CREDITS) : limit;
}

/** null when the clip fits; otherwise why it doesn't. */
export function refuseClip(usage: VoiceUsage, cost: number, priority: VoicePriority): string | null {
  const left = usage.budget - usage.used - SAFETY_MARGIN;
  const reserve = priority === "extra" ? MAIN_STORY_RESERVE : 0;
  if (cost <= left - reserve) return null;
  const when = usage.resetsAt ? ` until ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "";
  return cost <= left
    ? `Saving ElevenLabs credits for the main stories — using the iPhone voice for highlights${when}.`
    : `This month's ElevenLabs credits are used up — using the iPhone voice${when}.`;
}

export class VoiceBudgetError extends Error {
  readonly status = 402;
  readonly code = "voice-budget";
}

// --- Live usage from ElevenLabs --------------------------------------------------

interface Snapshot {
  key: string;
  usage: VoiceUsage | null; // null = the key can't read usage
  fetchedAt: number;
  spentSince: number; // credits we've used since this snapshot
  exhausted: boolean; // ElevenLabs said the quota is used up
}
let snapshot: Snapshot | null = null;

/**
 * Current usage, cached for a minute. Returns null if the key isn't allowed to
 * read it (a restricted key without "User: read"); ElevenLabs then still stops
 * at the plan's limit, but the app can't hold back a reserve.
 */
export async function readUsage(apiKey: string, stayFree: boolean, force = false): Promise<VoiceUsage | null> {
  const fresh = snapshot && snapshot.key === apiKey && Date.now() - snapshot.fetchedAt < USAGE_TTL_MS;
  if (!fresh || force) {
    let usage: VoiceUsage | null = null;
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": apiKey } });
      if (res.ok) {
        const s = (await res.json()) as { character_count: number; character_limit: number; next_character_count_reset_unix?: number; tier?: string };
        usage = {
          used: s.character_count,
          limit: s.character_limit,
          budget: budgetOf(s.character_limit, stayFree),
          resetsAt: s.next_character_count_reset_unix ? s.next_character_count_reset_unix * 1000 : null,
          tier: s.tier ?? "unknown",
        };
      }
    } catch {
      /* offline: fall through with no usage */
    }
    snapshot = { key: apiKey, usage, fetchedAt: Date.now(), spentSince: 0, exhausted: false };
  }
  const s = snapshot!;
  return s.usage && { ...s.usage, budget: budgetOf(s.usage.limit, stayFree), used: s.usage.used + s.spentSince };
}

export function recordSpend(apiKey: string, cost: number): void {
  if (snapshot?.key === apiKey) snapshot.spentSince += cost;
}

/** ElevenLabs reported quota_exceeded: stop asking until usage is re-read. */
export function markExhausted(apiKey: string): void {
  if (snapshot?.key === apiKey) snapshot.exhausted = true;
}

export function isExhausted(apiKey: string): boolean {
  return snapshot?.key === apiKey && snapshot.exhausted && Date.now() - snapshot.fetchedAt < USAGE_TTL_MS;
}
