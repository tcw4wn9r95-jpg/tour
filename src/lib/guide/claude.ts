import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod/v4";
import type { Effort, GuideEnv } from "./env";

// Server-side refusal fallbacks re-run a declined request on another model
// inside the same call. Only sent for models that support the "default" form.
const FALLBACK_MODELS = ["claude-opus-5", "claude-fable-5-1"];
const fallbacksRejected = new Set<string>();

/** The guide's Claude client; only called after checking env.claude. */
function clientOf(env: GuideEnv): Anthropic {
  if (!env.claude) throw new GuideError("Add an Anthropic API key to plan real tours.", 503);
  return env.claude;
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
export async function withFallbacks<T>(env: GuideEnv, params: BetaParams, run: (client: Anthropic, p: BetaParams) => Promise<T>): Promise<T> {
  const client = clientOf(env);
  if (!FALLBACK_MODELS.includes(params.model) || fallbacksRejected.has(params.model)) return run(client, params);
  const withFb: BetaParams = {
    ...params,
    betas: [...(params.betas ?? []), "server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
  try {
    return await run(client, withFb);
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      console.warn("Refusal fallbacks rejected; continuing without them:", err.message);
      fallbacksRejected.add(params.model);
      return run(client, params);
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
export async function generateStructured<S extends z.ZodType>(env: GuideEnv, schema: S, opts: StructuredOptions): Promise<z.infer<S>> {
  const params: BetaParams = {
    model: env.model,
    max_tokens: opts.maxTokens ?? 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? env.effort, format: betaZodOutputFormat(schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  };

  const message = await withFallbacks(env, params, async (client, p) => {
    const stream = client.beta.messages.stream(p, { signal: opts.signal });
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
