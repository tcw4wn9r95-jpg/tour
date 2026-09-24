import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateLeg, estimateLegs, orderStops, parseStartTime, scheduleTour, WALK_LIMIT_M } from "./route.ts";
import type { Stop } from "./types";

process.env.TZ = "UTC";

const stop = (id: string, lat: number, lng: number, extra: Partial<Stop> = {}): Stop => ({
  id,
  name: id,
  lat,
  lng,
  category: "history",
  wikipediaTitle: null,
  summary: "",
  whyForYou: "",
  durationMin: 60,
  openingNote: "",
  anchor: "none",
  ...extra,
});

test("legs within 1 km are walked, longer ones use the chosen long-leg mode", () => {
  const a = { lat: 38.7, lng: -9.14 };
  const near = { lat: 38.7045, lng: -9.14 }; // ~500 m straight, ~650 m walking
  const far = { lat: 38.73, lng: -9.14 }; // ~3.3 km
  assert.equal(estimateLeg(a, near, "transit").mode, "walk");
  assert.ok(estimateLeg(a, near, "transit").distanceM <= WALK_LIMIT_M);
  assert.equal(estimateLeg(a, far, "transit").mode, "transit");
  assert.equal(estimateLeg(a, far, "car").mode, "car");
});

test("orders stops along a line instead of zig-zagging", () => {
  const stops = [stop("c", 0, 0.02), stop("a", 0, 0), stop("d", 0, 0.03), stop("b", 0, 0.01)];
  const ordered = orderStops(stops, "transit", { lat: 0, lng: -0.005 });
  assert.deepEqual(ordered.map((s) => s.id), ["a", "b", "c", "d"]);
});

test("respects first/last anchors", () => {
  const stops = [stop("a", 0, 0), stop("b", 0, 0.01), stop("c", 0, 0.02, { anchor: "first" }), stop("d", 0, 0.03, { anchor: "last" })];
  const ordered = orderStops(stops, "transit");
  assert.equal(ordered[0].id, "c");
  assert.equal(ordered[ordered.length - 1].id, "d");
});

test("heuristic path handles larger tours", () => {
  const stops = Array.from({ length: 12 }, (_, i) => stop(`s${i}`, 0, ((i * 7) % 12) * 0.004));
  const ordered = orderStops(stops, "transit");
  const lngs = ordered.map((s) => s.lng);
  const sorted = [...lngs].sort((x, y) => x - y);
  const reversed = [...sorted].reverse();
  assert.ok(JSON.stringify(lngs) === JSON.stringify(sorted) || JSON.stringify(lngs) === JSON.stringify(reversed));
});

test("inserts a lunch break around noon and suggests dinner when ending in the evening", () => {
  const stops = [stop("a", 0, 0), stop("b", 0, 0.005), stop("c", 0, 0.01), stop("d", 0, 0.015), stop("e", 0, 0.02)];
  stops.forEach((s) => (s.durationMin = 90));
  const legs = estimateLegs(stops, "transit");
  const s = scheduleTour(stops, legs, new Date("2026-09-24T10:00:00Z"));
  const lunch = s.meals.find((m) => m.kind === "lunch");
  assert.ok(lunch, "lunch expected");
  const lunchHour = new Date(lunch!.at).getUTCHours();
  assert.ok(lunchHour >= 11 && lunchHour <= 14, `lunch at ${lunch!.at}`);
  // the stop after lunch starts after lunch ends
  const idx = stops.findIndex((x) => x.id === lunch!.afterStopId);
  assert.ok(new Date(s.stops[idx + 1].arriveAt!).getTime() >= new Date(lunch!.at).getTime() + 60 * 60_000);
  assert.ok(new Date(s.endAt).getTime() > new Date(s.startAt).getTime());
});

test("short morning tour gets no meal breaks inside it", () => {
  const stops = [stop("a", 0, 0), stop("b", 0, 0.005)];
  const s = scheduleTour(stops, estimateLegs(stops, "transit"), new Date("2026-09-24T09:45:00Z"));
  assert.equal(s.meals.filter((m) => m.afterStopId !== "b").length, 0);
});

test("parseStartTime understands 24h and am/pm and never goes back in time", () => {
  const now = new Date("2026-09-24T09:00:00Z");
  assert.equal(parseStartTime("14:30", now).toISOString(), "2026-09-24T14:30:00.000Z");
  assert.equal(parseStartTime("2 pm", now).toISOString(), "2026-09-24T14:00:00.000Z");
  assert.equal(parseStartTime("08:00", now).toISOString(), now.toISOString());
  assert.equal(parseStartTime("nonsense", now).toISOString(), now.toISOString());
});

test("doesn't schedule lunch right after a food stop", () => {
  const stops = [stop("bakery", 0, 0, { category: "food", durationMin: 30 }), stop("museum", 0, 0.004, { durationMin: 60 })];
  const s = scheduleTour(stops, estimateLegs(stops, "transit"), new Date("2026-09-24T11:35:00Z"));
  const lunch = s.meals.find((m) => m.kind === "lunch");
  assert.ok(lunch);
  assert.equal(lunch!.afterStopId, "museum");
});
