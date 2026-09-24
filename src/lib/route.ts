// Route planning: visit order, per-leg transport mode, and the day's schedule
// (including meal breaks placed by time of day). Pure functions, no I/O.
import { haversine } from "./geo.ts";
import type { LatLng, Leg, LegMode, LongLegMode, MealKind, MealSlot, Stop } from "./types";

/** Legs up to this walking distance are walked; longer ones use transit or a car. */
export const WALK_LIMIT_M = 1000;
const WALK_DETOUR = 1.3; // street network vs. straight line
const WALK_M_PER_MIN = 78; // ~4.7 km/h, sightseeing pace

export function walkMinutes(distanceM: number): number {
  return distanceM / WALK_M_PER_MIN;
}

export function longLegEstimate(straightM: number, mode: LongLegMode): { distanceM: number; durationMin: number } {
  if (mode === "transit") {
    const distanceM = straightM * 1.35;
    // walk to the station + wait, then ~18 km/h door to door
    return { distanceM, durationMin: 8 + (distanceM / 1000 / 18) * 60 };
  }
  const distanceM = straightM * 1.4;
  // hail a taxi / park, then ~22 km/h in city traffic
  return { distanceM, durationMin: 5 + (distanceM / 1000 / 22) * 60 };
}

export function estimateLeg(a: LatLng, b: LatLng, longMode: LongLegMode): { mode: LegMode; distanceM: number; durationMin: number } {
  const straight = haversine(a, b);
  const walkDistance = straight * WALK_DETOUR;
  if (walkDistance <= WALK_LIMIT_M) {
    return { mode: "walk", distanceM: walkDistance, durationMin: walkMinutes(walkDistance) };
  }
  return { mode: longMode, ...longLegEstimate(straight, longMode) };
}

/**
 * Most efficient visiting order (minimum total travel time) as an open path.
 * Starts next to `start` when given, and honours at most one stop anchored
 * "first" and one anchored "last" (e.g. a sunset viewpoint).
 */
export function orderStops<T extends LatLng & { anchor?: Stop["anchor"] }>(
  stops: T[],
  longMode: LongLegMode,
  start?: LatLng,
): T[] {
  const n = stops.length;
  if (n <= 2 && !start) return applyAnchorsTrivially(stops);

  const cost: number[][] = stops.map((a) => stops.map((b) => estimateLeg(a, b, longMode).durationMin));
  const startCost = stops.map((s) => (start ? estimateLeg(start, s, longMode).durationMin : 0));
  const firstIdx = stops.findIndex((s) => s.anchor === "first");
  let lastIdx = stops.findIndex((s) => s.anchor === "last");
  if (lastIdx === firstIdx) lastIdx = -1;

  const total = (order: number[]) => {
    let t = startCost[order[0]];
    for (let k = 0; k + 1 < order.length; k++) t += cost[order[k]][order[k + 1]];
    return t;
  };

  let best: number[];
  if (n <= 9) {
    best = exactOrder(n, cost, startCost, firstIdx, lastIdx);
  } else {
    best = heuristicOrder(n, cost, firstIdx, lastIdx, total);
  }
  return best.map((i) => stops[i]);
}

function applyAnchorsTrivially<T extends { anchor?: Stop["anchor"] }>(stops: T[]): T[] {
  if (stops.length === 2 && (stops[1].anchor === "first" || stops[0].anchor === "last")) return [stops[1], stops[0]];
  return [...stops];
}

/** Branch and bound over all permutations; fine for the 3-9 stops of a day tour. */
function exactOrder(n: number, cost: number[][], startCost: number[], firstIdx: number, lastIdx: number): number[] {
  let bestCost = Infinity;
  let best: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const path: number[] = [];

  const visit = (acc: number) => {
    if (acc >= bestCost) return;
    if (path.length === n) {
      bestCost = acc;
      best = [...path];
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      if (path.length === 0 && firstIdx >= 0 && i !== firstIdx) continue;
      if (i === lastIdx && path.length !== n - 1) continue;
      const step = path.length === 0 ? startCost[i] : cost[path[path.length - 1]][i];
      used[i] = true;
      path.push(i);
      visit(acc + step);
      path.pop();
      used[i] = false;
    }
  };
  visit(0);
  return best;
}

/** Nearest neighbour from every allowed first stop, polished with 2-opt. */
function heuristicOrder(
  n: number,
  cost: number[][],
  firstIdx: number,
  lastIdx: number,
  total: (order: number[]) => number,
): number[] {
  const firsts = firstIdx >= 0 ? [firstIdx] : [...Array(n).keys()].filter((i) => i !== lastIdx);
  let best: number[] = [];
  let bestCost = Infinity;
  for (const first of firsts) {
    const order = [first];
    const used = new Set(order);
    if (lastIdx >= 0) used.add(lastIdx);
    while (order.length < n - (lastIdx >= 0 ? 1 : 0)) {
      const cur = order[order.length - 1];
      let next = -1;
      for (let j = 0; j < n; j++) if (!used.has(j) && (next < 0 || cost[cur][j] < cost[cur][next])) next = j;
      order.push(next);
      used.add(next);
    }
    if (lastIdx >= 0) order.push(lastIdx);
    twoOpt(order, total, firstIdx >= 0 ? 1 : 0, lastIdx >= 0 ? n - 2 : n - 1);
    const c = total(order);
    if (c < bestCost) {
      bestCost = c;
      best = order;
    }
  }
  return best;
}

function twoOpt(order: number[], total: (order: number[]) => number, lo: number, hi: number) {
  let improved = true;
  let current = total(order);
  while (improved) {
    improved = false;
    for (let i = lo; i < hi; i++) {
      for (let j = i + 1; j <= hi; j++) {
        reverse(order, i, j);
        const c = total(order);
        if (c + 1e-9 < current) {
          current = c;
          improved = true;
        } else {
          reverse(order, i, j);
        }
      }
    }
  }
}

function reverse(a: number[], i: number, j: number) {
  while (i < j) {
    [a[i], a[j]] = [a[j], a[i]];
    i++;
    j--;
  }
}

/** Straight-line estimates for every leg; the client later refines them with real routes. */
export function estimateLegs(ordered: Stop[], longMode: LongLegMode, start?: LatLng): Leg[] {
  const legs: Leg[] = [];
  if (start && ordered.length > 0) {
    legs.push({ fromId: "start", toId: ordered[0].id, ...estimateLeg(start, ordered[0], longMode) });
  }
  for (let k = 0; k + 1 < ordered.length; k++) {
    legs.push({ fromId: ordered[k].id, toId: ordered[k + 1].id, ...estimateLeg(ordered[k], ordered[k + 1], longMode) });
  }
  return legs;
}

// ---------------------------------------------------------------------------
// Schedule

interface MealRule {
  kind: MealKind;
  /** minutes after midnight (device local time) */
  from: number;
  to: number;
  durationMin: number;
}

const MEALS: MealRule[] = [
  { kind: "breakfast", from: 7 * 60, to: 9 * 60 + 30, durationMin: 30 },
  { kind: "lunch", from: 11 * 60 + 50, to: 14 * 60 + 30, durationMin: 60 },
  { kind: "coffee", from: 15 * 60 + 30, to: 17 * 60, durationMin: 20 },
  { kind: "dinner", from: 18 * 60 + 50, to: 21 * 60 + 30, durationMin: 75 },
];

const minuteOfDay = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};
const MIN = 60_000;

export interface Schedule {
  stops: Stop[];
  legs: Leg[];
  meals: MealSlot[];
  startAt: string;
  endAt: string;
}

/**
 * Walks the day from `startAt`: travel, visit, and insert a meal break
 * whenever the clock enters a meal window (lunch around noon, dinner in the
 * evening, a coffee break on long afternoons, breakfast on early starts).
 */
export function scheduleTour(ordered: Stop[], legs: Leg[], startAt: Date): Schedule {
  const legTo = new Map(legs.map((l) => [l.toId, l]));
  const meals: MealSlot[] = [];
  const taken = new Set<MealKind>();
  let lastBreakAt = startAt.getTime();
  let t = startAt.getTime();

  const addMeal = (rule: MealRule, afterStop: Stop | null, near: Stop) => {
    meals.push({
      id: `${rule.kind}-${meals.length}`,
      kind: rule.kind,
      at: new Date(t).toISOString(),
      durationMin: rule.durationMin,
      afterStopId: afterStop ? afterStop.id : null,
      near: { lat: near.lat, lng: near.lng },
      nearName: near.name,
    });
    taken.add(rule.kind);
    t += rule.durationMin * MIN;
    lastBreakAt = t;
  };

  const mealDue = (allowLate: boolean, justVisited?: Stop): MealRule | undefined => {
    const m = minuteOfDay(t);
    const justAte = justVisited && (justVisited.category === "food" || justVisited.category === "market");
    return MEALS.find((rule) => {
      if (taken.has(rule.kind)) return false;
      // Just had pastries at a bakery or grazed a market? Push the meal to the next stop.
      if (justAte && m < rule.from + 75) return false;
      if (rule.kind === "breakfast" && (meals.length > 0 || t !== startAt.getTime())) return false;
      if (rule.kind === "coffee" && t - lastBreakAt < 150 * MIN) return false;
      const lateSlack = allowLate && rule.kind !== "breakfast" ? 40 : 0;
      return m >= rule.from && m <= rule.to + lateSlack;
    });
  };

  if (ordered.length > 0) {
    const breakfast = mealDue(false);
    if (breakfast?.kind === "breakfast") addMeal(breakfast, null, ordered[0]);
  }

  const outLegs: Leg[] = [];
  const outStops: Stop[] = ordered.map((stop, k) => {
    const leg = legTo.get(stop.id);
    if (leg) {
      outLegs.push({ ...leg, departAt: new Date(t).toISOString() });
      t += leg.durationMin * MIN;
    }
    const arriveAt = new Date(t).toISOString();
    t += stop.durationMin * MIN;
    const departAt = new Date(t).toISOString();
    const isLast = k === ordered.length - 1;
    if (!isLast) {
      const rule = mealDue(true, stop);
      if (rule) addMeal(rule, stop, stop);
    }
    return { ...stop, arriveAt, departAt };
  });

  const endAt = new Date(t).toISOString();

  // Finishing close to a mealtime? Suggest eating near the last stop.
  const last = ordered[ordered.length - 1];
  if (last) {
    const m = minuteOfDay(t);
    const after = MEALS.find(
      (rule) => rule.kind !== "breakfast" && rule.kind !== "coffee" && !taken.has(rule.kind) && m >= rule.from - 60 && m <= rule.to,
    );
    if (after) {
      const at = Math.max(t, startOfDayMs(t) + after.from * MIN);
      meals.push({
        id: `${after.kind}-${meals.length}`,
        kind: after.kind,
        at: new Date(at).toISOString(),
        durationMin: after.durationMin,
        afterStopId: last.id,
        near: { lat: last.lat, lng: last.lng },
        nearName: last.name,
      });
    }
  }

  return { stops: outStops, legs: outLegs, meals, startAt: startAt.toISOString(), endAt };
}

function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Round up to the next 5 minutes so the plan starts on a friendly time. */
export function roundUpTo5(date: Date): Date {
  const ms = 5 * MIN;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/** "14:30" -> today at 14:30 local time; tolerant of "2:30 PM". Falls back to `fallback`. */
export function parseStartTime(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const m = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return fallback;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return fallback;
  const d = new Date(fallback);
  d.setHours(h, min, 0, 0);
  // Never schedule into the past.
  return d.getTime() < fallback.getTime() ? fallback : d;
}
