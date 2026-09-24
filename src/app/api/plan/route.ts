import { describeError } from "@/lib/guide/claude";
import { planTour, type PlanProgress } from "@/lib/guide/service";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { serverEnv } from "@/lib/server/env";
import { readJson, TourRequestInput } from "@/lib/server/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

type PlanEvent = PlanProgress | { type: "plan"; plan: unknown; demo?: boolean } | { type: "error"; message: string } | { type: "ping" };

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
        const { plan, demo } = await planTour(serverEnv(), input, send, req.signal);
        send({ type: "plan", plan, demo });
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
