// Local stand-in for the Claude Messages API (streaming), for developing without an API key:
//   npm run mock   then   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev
import http from "node:http";
import { DEMO_PLAN, demoDetails, demoRestaurants } from "../src/lib/demo.ts";

const log: unknown[] = [];
let rejectedFallbacks = false;

function sse(res: http.ServerResponse, events: [string, unknown][]) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const [event, data] of events) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  res.end();
}

const start = (model: string) => ["message_start", { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } }] as [string, unknown];
const end = (reason: string) => [
  ["message_delta", { type: "message_delta", delta: { stop_reason: reason }, usage: { output_tokens: 100 } }],
  ["message_stop", { type: "message_stop" }],
] as [string, unknown][];

function textStream(model: string, text: string): [string, unknown][] {
  const chunks = text.match(/[\s\S]{1,40}/g) ?? [];
  return [
    start(model),
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ...chunks.map((c) => ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: c } }] as [string, unknown]),
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ...end("end_turn"),
  ];
}

http
  .createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    if (req.url === "/__log") return res.end(JSON.stringify(log, null, 1));
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST" });
      return res.end();
    }
    res.setHeader("access-control-allow-origin", "*");
    if (req.method === "GET" && req.url?.startsWith("/v1/models/")) {
      const id = decodeURIComponent(req.url.slice("/v1/models/".length));
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "model", id, display_name: id, created_at: "2026-01-01T00:00:00Z" }));
    }
    const json = JSON.parse(body || "{}");
    const system = typeof json.system === "string" ? json.system : JSON.stringify(json.system);
    log.push({ url: req.url, beta: req.headers["anthropic-beta"], model: json.model, thinking: json.thinking, output_config: json.output_config && { effort: json.output_config.effort, format: json.output_config.format?.type }, fallbacks: json.fallbacks, tools: json.tools?.map((t: { name: string; type?: string }) => t.type ?? t.name), stream: json.stream, system: system.slice(0, 60) });

      // The first request carrying `fallbacks` is rejected to exercise the retry-without-fallbacks path.
    if (json.fallbacks && !rejectedFallbacks) {
      rejectedFallbacks = true;
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "fallbacks: not supported (mock)" } }));
    }
    const model = json.model;
    if (system.includes("itinerary planner")) return sse(res, textStream(model, JSON.stringify(DEMO_PLAN)));
    if (system.includes("in-app guide page")) {
      const name = /Stop: (.*?) \(/.exec(json.messages[0].content)?.[1] ?? "";
      return sse(res, textStream(model, JSON.stringify(demoDetails(name))));
    }
    if (system.includes("one-minute audio welcome")) {
      return sse(res, textStream(model, JSON.stringify({ title: "Your day in Lisbon", mood: "warm", script: "Welcome to Lisbon. " + "Today we walk and taste. ".repeat(10) })));
    }
    if (system.includes("savvy local friend")) {
      const slots = [...json.messages[0].content.matchAll(/slotId "([^"]+)": (\w+)/g)].map((m: RegExpMatchArray) => ({ slotId: m[1], kind: m[2] }));
      const picks = { slots: demoRestaurants(slots).map((r) => ({ slotId: r.slotId, restaurants: r.restaurants.map(({ distanceM, mapsUrl, ...rest }) => rest) })) };
      const input = JSON.stringify(picks);
      return sse(res, [
        start(model),
        ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_1", name: "submit_restaurants", input: {} } }],
        ...(input.match(/[\s\S]{1,50}/g) ?? []).map((c) => ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: c } }] as [string, unknown]),
        ["content_block_stop", { type: "content_block_stop", index: 0 }],
        ...end("tool_use"),
      ]);
    }
    res.writeHead(500);
    res.end("unexpected");
  })
  .listen(4010, () => console.log("mock on 4010"));
