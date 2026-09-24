// A Claude turn loop with web search plus one "submit" tool whose input is
// validated against a Zod schema. Also returns every URL the searches
// actually surfaced, so callers can drop anything citing a page never seen.
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import { GuideError, withFallbacks } from "./claude";
import type { GuideEnv } from "./env";

type Message = Anthropic.Beta.Messages.BetaMessage;

export interface ResearchOptions<S extends z.ZodType> {
  system: string;
  prompt: string;
  tool: { name: string; description: string };
  schema: S;
  maxSearches: number;
  location?: { city: string; timezone?: string };
  /** Shown if the loop gives up. */
  failure: string;
}

function collectSources(message: Message, into: Set<string>) {
  for (const block of message.content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const result of block.content) if (result.type === "web_search_result") into.add(result.url);
  }
}

export async function researchWithWebSearch<S extends z.ZodType>(
  env: GuideEnv,
  opts: ResearchOptions<S>,
): Promise<{ data: z.infer<S>; sources: Set<string> }> {
  const submitTool: Anthropic.Beta.Messages.BetaTool = {
    name: opts.tool.name,
    description: opts.tool.description,
    strict: true,
    input_schema: betaZodOutputFormat(opts.schema).schema as Anthropic.Beta.Messages.BetaTool.InputSchema,
  };
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: opts.prompt }];
  const sources = new Set<string>();

  for (let turn = 0; turn < 6; turn++) {
    const message: Message = await withFallbacks(
      env,
      {
        model: env.model,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: env.effort },
        system: opts.system,
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: opts.maxSearches,
            ...(opts.location && { user_location: { type: "approximate" as const, city: opts.location.city, timezone: opts.location.timezone } }),
          },
          submitTool,
        ],
        messages,
      },
      (client, p) => client.beta.messages.stream(p).finalMessage(),
    );
    collectSources(message, sources);

    if (message.stop_reason === "refusal") throw new GuideError(opts.failure, 422);

    const call = message.content.find(
      (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use" && b.name === opts.tool.name,
    );
    messages.push({ role: "assistant", content: message.content });
    if (call) {
      const parsed = opts.schema.safeParse(call.input);
      if (parsed.success) return { data: parsed.data, sources };
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: "Input did not match the schema; please resubmit." }],
      });
      continue;
    }
    if (message.stop_reason === "pause_turn") continue; // long web research; let it resume
    messages.push({ role: "user", content: `Please call ${opts.tool.name} now.` });
  }
  throw new GuideError(opts.failure);
}

