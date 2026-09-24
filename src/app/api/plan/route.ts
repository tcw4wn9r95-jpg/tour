import { DEMO_PLAN } from "@/lib/demo";
import { PlanSchema } from "@/lib/schemas";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { describeError, generateStructured, hasClaude } from "@/lib/server/claude";
import { PLAN_SYSTEM, planPrompt } from "@/lib/server/prompts";
import { readJson, TourRequestInput } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

type PlanEvent =
  | { type: "status"; message: string }
  | { type: "stop"; name: string }
  | { type: "plan"; plan: unknown; demo?: boolean }
  | { type: "error"; message: string }
  | { type: "ping" };

const NAME_RE = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

/**
 * Streams newline-delimited JSON events so the chat can show progress
 * (stops appear as Claude writes them) and slow proxies never see an idle socket.
 */
export async function POST(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  const input = await readJson(req, TourRequestInput);
  if (input instanceof Response) return input;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: PlanEvent) => {
        if (!closed) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const heartbeat = setInterval(() => send({ type: "ping" }), 8000);
      try {
        if (!hasClaude()) {
          send({ type: "status", message: "Demo mode — no Anthropic API key yet, so here's a sample Lisbon tour." });
          for (const s of DEMO_PLAN.stops) {
            await new Promise((r) => setTimeout(r, 250));
            send({ type: "stop", name: s.name });
          }
          send({ type: "plan", plan: DEMO_PLAN, demo: true });
          return;
        }
        send({ type: "status", message: `Thinking about ${input.city} on a ${input.now.weekday}…` });
        const seen = new Set<string>();
        let scanned = 0;
        const plan = await generateStructured(PlanSchema, {
          system: PLAN_SYSTEM,
          prompt: planPrompt(input),
          signal: req.signal,
          onText: (soFar) => {
            NAME_RE.lastIndex = Math.max(0, scanned - 300);
            for (const m of soFar.matchAll(NAME_RE)) {
              if (seen.has(m[1])) continue;
              seen.add(m[1]);
              try {
                send({ type: "stop", name: JSON.parse(`"${m[1]}"`) });
              } catch {
                /* partial escape sequence; the next delta completes it */
                seen.delete(m[1]);
              }
            }
            scanned = soFar.length;
          },
        });
        send({ type: "plan", plan });
      } catch (err) {
        send({ type: "error", message: describeError(err).message });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
