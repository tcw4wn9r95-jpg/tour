import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod/v4";

export const MODEL = process.env.TOUR_CLAUDE_MODEL || "claude-opus-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];
export const DEFAULT_EFFORT: Effort = EFFORTS.includes(process.env.TOUR_CLAUDE_EFFORT as Effort)
  ? (process.env.TOUR_CLAUDE_EFFORT as Effort)
  : "medium";

// Server-side refusal fallbacks re-run a declined request on another model
// inside the same call. Only sent for models that support the "default" form.
const FALLBACK_MODELS = ["claude-opus-5", "claude-fable-5-1"];
let fallbacksEnabled = FALLBACK_MODELS.includes(MODEL);

let client: Anthropic | null = null;

export function hasClaude(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function claude(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 2 });
  return client;
}

export class GuideError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

type BetaParams = BetaMessageStreamParams;

/** Adds the refusal-fallback beta when supported; drops it for good if the API rejects it. */
export async function withFallbacks<T>(params: BetaParams, run: (p: BetaParams) => Promise<T>): Promise<T> {
  if (!fallbacksEnabled) return run(params);
  const withFb: BetaParams = {
    ...params,
    betas: [...(params.betas ?? []), "server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
  try {
    return await run(withFb);
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      console.warn("Refusal fallbacks rejected; continuing without them:", err.message);
      fallbacksEnabled = false;
      return run(params);
    }
    throw err;
  }
}

interface StructuredOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  effort?: Effort;
  /** Called with the accumulated JSON text as it streams (for progress UI). */
  onText?: (soFar: string) => void;
  signal?: AbortSignal;
}

/**
 * One Claude call whose answer is JSON validated against `schema`.
 * Streams so long outputs never hit HTTP timeouts.
 */
export async function generateStructured<S extends z.ZodType>(schema: S, opts: StructuredOptions): Promise<z.infer<S>> {
  const params: BetaParams = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? DEFAULT_EFFORT, format: betaZodOutputFormat(schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  };

  const message = await withFallbacks(params, async (p) => {
    const stream = claude().beta.messages.stream(p, { signal: opts.signal });
    if (opts.onText) {
      let soFar = "";
      stream.on("text", (delta) => {
        soFar += delta;
        opts.onText!(soFar);
      });
    }
    return stream.finalMessage();
  });

  if (message.stop_reason === "refusal") {
    throw new GuideError("Claude declined to plan this request. Try rephrasing your special requests.", 422);
  }
  if (message.stop_reason === "max_tokens") {
    throw new GuideError("The plan came out too long. Try a shorter time window or fewer requests.");
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = schema.safeParse(message.parsed_output ?? safeJson(text));
  if (!parsed.success) {
    console.error("Unparseable Claude output", parsed.error, text.slice(0, 500));
    throw new GuideError("Claude returned an unexpected answer. Please try again.");
  }
  return parsed.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Maps SDK errors to a short message the phone UI can show. */
export function describeError(err: unknown): { message: string; status: number } {
  if (err instanceof GuideError) return { message: err.message, status: err.status };
  if (err instanceof Anthropic.AuthenticationError) return { message: "The Anthropic API key is invalid.", status: 500 };
  if (err instanceof Anthropic.RateLimitError) return { message: "Claude is busy right now — try again in a minute.", status: 429 };
  if (err instanceof Anthropic.APIError) return { message: `Claude API error (${err.status ?? "network"}).`, status: 502 };
  console.error(err);
  return { message: "Something went wrong while talking to Claude.", status: 500 };
}
