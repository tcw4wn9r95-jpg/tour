"use client";
// Runs on the phone: turns Claude's plan into a finished tour (verified
// coordinates, photos, optimal order, real walking routes, schedule), then
// fills in stop guides, the welcome narration and restaurant picks in the
// background. Wikimedia/OSM calls come from the device, not the server, so
// they aren't rate-limited as shared datacenter traffic.
import { centroid, formatClock, formatDistance, formatDuration, haversine, MODE_LABEL } from "../geo.ts";
import { estimateLegs, longLegEstimate, orderStops, parseStartTime, roundUpTo5, scheduleTour, walkMinutes, WALK_LIMIT_M } from "../route.ts";
import { hasAudioGuide } from "../labels";
import type { StopContent } from "../schemas";
import type { LatLng, Leg, LongLegMode, Photo, RawPlan, Stop, StopDetails, Tour, TourRequest } from "../types";
import { fetchRestaurants, fetchStopDetails, fetchTodayIntro } from "./api";
import { useEffect, useState } from "react";
import { getTour, saveTour, updateTour } from "./store";

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

async function getJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Wikipedia / Wikimedia Commons

interface WikiPage {
  title: string;
  coordinates?: { lat: number; lon: number }[];
  thumbnail?: { source: string };
  fullurl?: string;
  missing?: boolean;
}

interface WikiHit {
  lat?: number;
  lng?: number;
  photo?: Photo;
  url?: string;
}

export async function wikiLookup(titles: string[]): Promise<Map<string, WikiHit>> {
  const out = new Map<string, WikiHit>();
  const unique = [...new Set(titles.filter(Boolean))];
  if (unique.length === 0) return out;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    redirects: "1",
    prop: "coordinates|pageimages|info",
    piprop: "thumbnail",
    pithumbsize: "1280",
    inprop: "url",
    colimit: "max",
    titles: unique.join("|"),
  });
  const data = await getJson<{
    query?: { pages?: WikiPage[]; normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] };
  }>(`${WIKI_API}?${params}`);
  const q = data.query ?? {};
  const resolve = (t: string) => {
    let cur = t;
    for (const map of [q.normalized ?? [], q.redirects ?? []]) cur = map.find((m) => m.from === cur)?.to ?? cur;
    return cur;
  };
  const byTitle = new Map((q.pages ?? []).filter((p) => !p.missing).map((p) => [p.title, p]));
  for (const t of unique) {
    const page = byTitle.get(resolve(t));
    if (!page) continue;
    const c = page.coordinates?.[0];
    out.set(t, {
      lat: c?.lat,
      lng: c?.lon,
      url: page.fullurl,
      photo: page.thumbnail ? { url: page.thumbnail.source, credit: "Wikipedia", sourceUrl: page.fullurl } : undefined,
    });
  }
  return out;
}

/** Single-article fallback (REST API), used when the batched query is unavailable. */
export async function wikiSummary(title: string): Promise<WikiHit | undefined> {
  const data = await getJson<{
    type?: string;
    coordinates?: { lat: number; lon: number };
    thumbnail?: { source: string };
    originalimage?: { source: string; width: number };
    content_urls?: { mobile?: { page: string } };
  }>(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (data.type === "disambiguation") return undefined;
  const url = data.content_urls?.mobile?.page;
  const img = data.originalimage && data.originalimage.width <= 1600 ? data.originalimage.source : data.thumbnail?.source.replace(/\/\d+px-/, "/1280px-");
  return {
    lat: data.coordinates?.lat,
    lng: data.coordinates?.lon,
    url,
    photo: img ? { url: img, credit: "Wikipedia", sourceUrl: url } : undefined,
  };
}

const JUNK_IMAGE = /logo|icon|flag|coat[_ ]of[_ ]arms|symbol|locator|map|plan|seal|signature|\.svg|\.gif|\.tif/i;

/** Photos from a Wikipedia article, for the stop's gallery. */
export async function wikiGallery(title: string, limit = 8): Promise<Photo[]> {
  const data = await getJson<{ items?: { title: string; type: string; srcset?: { src: string }[]; caption?: { text: string } }[] }>(
    `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  );
  return (data.items ?? [])
    .filter((i) => i.type === "image" && i.srcset?.length && !JUNK_IMAGE.test(i.title))
    .slice(0, limit)
    .map((i) => {
      const src = i.srcset![i.srcset!.length - 1].src;
      return {
        url: src.startsWith("//") ? `https:${src}` : src,
        caption: i.caption?.text,
        credit: "Wikimedia Commons",
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(i.title)}`,
      };
    });
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Best Wikimedia Commons photo for a search phrase (used for stop features). */
export async function commonsPhoto(query: string): Promise<Photo | undefined> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "3",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "960",
  });
  const data = await getJson<{
    query?: {
      pages?: {
        index: number;
        title: string;
        imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value: string }> }[];
      }[];
    };
  }>(`${COMMONS_API}?${params}`);
  const page = (data.query?.pages ?? [])
    .filter((p) => !JUNK_IMAGE.test(p.title) && p.imageinfo?.[0]?.thumburl)
    .sort((a, b) => a.index - b.index)[0];
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl) return undefined;
  const artist = info.extmetadata?.Artist?.value;
  const license = info.extmetadata?.LicenseShortName?.value;
  return {
    url: info.thumburl,
    credit: [artist ? stripHtml(artist) : "Wikimedia Commons", license].filter(Boolean).join(" · "),
    sourceUrl: info.descriptionurl,
  };
}

// ---------------------------------------------------------------------------
// OpenStreetMap: geocoding and routing

export async function reverseGeocode(p: LatLng): Promise<string | null> {
  const data = await getJson<{ address?: Record<string, string> }>(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${p.lat}&lon=${p.lng}`,
  );
  const a = data.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
  if (!city) return null;
  return a.country ? `${city}, ${a.country}` : city;
}

async function geocode(query: string, near: LatLng): Promise<LatLng | null> {
  const d = 0.25;
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    q: query,
    viewbox: `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
    "accept-language": "en",
  });
  const data = await getJson<{ lat: string; lon: string }[]>(`https://nominatim.openstreetmap.org/search?${params}`);
  return data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
}

interface RoutedLeg {
  distanceM: number;
  durationMin: number;
  path: [number, number][];
}

async function osrmRoute(a: LatLng, b: LatLng, profile: "foot" | "car"): Promise<RoutedLeg | null> {
  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const data = await getJson<{ routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }>(url);
  const r = data.routes?.[0];
  if (!r) return null;
  return {
    distanceM: r.distance,
    durationMin: r.duration / 60,
    path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Replaces straight-line estimates with real street routes; the 1 km walking rule uses the routed distance. */
async function refineLegs(legs: Leg[], points: Map<string, LatLng>, longMode: LongLegMode): Promise<Leg[]> {
  return mapLimit(legs, 3, async (leg) => {
    const a = points.get(leg.fromId)!;
    const b = points.get(leg.toId)!;
    const straight = haversine(a, b);
    try {
      if (straight <= WALK_LIMIT_M * 1.1) {
        const walk = await osrmRoute(a, b, "foot");
        if (walk && walk.distanceM <= WALK_LIMIT_M) {
          return { ...leg, mode: "walk", distanceM: walk.distanceM, durationMin: walkMinutes(walk.distanceM), path: walk.path };
        }
      }
      if (longMode === "car") {
        const drive = await osrmRoute(a, b, "car");
        if (drive) return { ...leg, mode: "car", distanceM: drive.distanceM, durationMin: 5 + drive.durationMin * 1.3, path: drive.path };
      }
      return { ...leg, mode: longMode, ...longLegEstimate(straight, longMode), path: undefined };
    } catch {
      return leg;
    }
  });
}

// ---------------------------------------------------------------------------
// Tour assembly

const clampDuration = (m: number) => Math.min(240, Math.max(10, Math.round(m || 30)));

export async function buildTour(
  plan: RawPlan,
  request: TourRequest,
  demo: boolean,
  onProgress: (message: string) => void,
): Promise<Tour> {
  let stops: Stop[] = plan.stops.map((s, i) => ({ ...s, id: `s${i + 1}`, durationMin: clampDuration(s.durationMin) }));
  const center = plan.center ?? centroid(stops);

  onProgress("Checking every location against Wikipedia and finding photos…");
  const titles = stops.map((s) => s.wikipediaTitle ?? s.name);
  const wiki = await wikiLookup(titles).catch(() => new Map<string, WikiHit>());
  const missing = titles.filter((t) => !wiki.get(t)?.photo);
  await mapLimit(missing, 3, async (t) => {
    const hit = await wikiSummary(t).catch(() => undefined);
    if (hit) wiki.set(t, { ...wiki.get(t), ...hit, lat: wiki.get(t)?.lat ?? hit.lat, lng: wiki.get(t)?.lng ?? hit.lng });
  });
  const unverified: Stop[] = [];
  stops = stops.map((s) => {
    const hit = wiki.get(s.wikipediaTitle ?? s.name);
    const next: Stop = { ...s, photo: hit?.photo, wikiUrl: hit?.url };
    if (hit?.lat != null && hit.lng != null && haversine(hit as LatLng, center) < 30_000) {
      next.lat = hit.lat;
      next.lng = hit.lng;
    } else {
      unverified.push(next);
    }
    return next;
  });

  // Nominatim allows ~1 request/second; only look up what Wikipedia couldn't confirm.
  for (const s of unverified.slice(0, 6)) {
    try {
      const p = await geocode(`${s.name}, ${plan.city}`, center);
      const claudeLooksOff = haversine(s, center) > 20_000;
      if (p && (haversine(p, s) < 3000 || (claudeLooksOff && haversine(p, center) < 20_000))) {
        s.lat = p.lat;
        s.lng = p.lng;
      }
    } catch {
      /* keep Claude's coordinates */
    }
    await sleep(1100);
  }

  const here = request.userLocation;
  const start = here && haversine(here, centroid(stops)) < 20_000 ? { ...here, label: "Your location" } : undefined;

  onProgress(`Finding the most efficient order for ${stops.length} stops…`);
  const ordered = orderStops(stops, plan.longLegMode, start);
  const points = new Map<string, LatLng>(ordered.map((s) => [s.id, s]));
  if (start) points.set("start", start);
  let legs = estimateLegs(ordered, plan.longLegMode, start);

  onProgress("Tracing walking routes between stops…");
  legs = await refineLegs(legs, points, plan.longLegMode);

  const startAt = parseStartTime(plan.startTime, roundUpTo5(new Date()));
  const schedule = scheduleTour(ordered, legs, startAt);

  const tour: Tour = {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    request,
    title: plan.title,
    subtitle: plan.subtitle,
    city: plan.city,
    region: plan.region,
    country: plan.country,
    center,
    intro: plan.intro,
    tips: plan.tips,
    longLegMode: plan.longLegMode,
    start,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    stops: schedule.stops,
    legs: schedule.legs,
    meals: schedule.meals,
    totalDistanceM: schedule.legs.reduce((sum, l) => sum + l.distanceM, 0),
    coverPhoto: schedule.stops.find((s) => s.photo)?.photo,
    demo,
  };
  await saveTour(tour);
  return tour;
}

// ---------------------------------------------------------------------------
// Background content: stop guides, welcome narration, restaurants

type TaskState = { running: number; failed: string[] };
const running = new Map<string, Promise<void>>();
const taskListeners = new Set<() => void>();
const taskState = new Map<string, TaskState>();

export function tourTaskState(tourId: string): TaskState {
  return taskState.get(tourId) ?? { running: 0, failed: [] };
}

export function onTaskChange(listener: () => void): () => void {
  taskListeners.add(listener);
  return () => taskListeners.delete(listener);
}

function track(tourId: string, key: string, work: () => Promise<void>): Promise<void> {
  const id = `${tourId}:${key}`;
  const existing = running.get(id);
  if (existing) return existing;
  const bump = (delta: number, failed?: string) => {
    const s = tourTaskState(tourId);
    const next = { running: s.running + delta, failed: failed ? [...s.failed.filter((f) => f !== failed), failed] : s.failed.filter((f) => f !== key) };
    taskState.set(tourId, next);
    for (const l of taskListeners) l();
  };
  bump(1);
  const p = work()
    .then(() => bump(-1))
    .catch((err) => {
      console.warn(`Task ${id} failed`, err);
      bump(-1, key);
    })
    .finally(() => running.delete(id));
  running.set(id, p);
  return p;
}

const localHHMM = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function ensureStopDetails(tourId: string, stopId: string): Promise<void> {
  return track(tourId, `stop:${stopId}`, async () => {
    const tour = await getTour(tourId);
    const stop = tour?.stops.find((s) => s.id === stopId);
    if (!tour || !stop || stop.details) return;
    const raw: StopContent = await fetchStopDetails({
      audio: hasAudioGuide(stop),
      city: tour.city,
      country: tour.country,
      focus: tour.request.focus,
      constraints: tour.request.constraints,
      weekday: tour.request.now.weekday,
      stop: {
        name: stop.name,
        category: stop.category,
        summary: stop.summary,
        arriveAt: stop.arriveAt ? formatClock(stop.arriveAt) : undefined,
        durationMin: stop.durationMin,
      },
    });
    const [gallery, featurePhotos] = await Promise.all([
      stop.wikipediaTitle ? wikiGallery(stop.wikipediaTitle).catch(() => []) : Promise.resolve([] as Photo[]),
      mapLimit(raw.features, 2, (f) => commonsPhoto(f.imageSearch).catch(() => undefined)),
    ]);
    const details: StopDetails = {
      overview: raw.overview,
      narration: raw.narration,
      practical: raw.practical,
      funFact: raw.funFact,
      gallery,
      features: raw.features.map((f, i) => ({ ...f, id: `${stopId}-f${i + 1}`, photo: featurePhotos[i] })),
    };
    await updateTour(tourId, (t) => {
      const stops = t.stops.map((s) => (s.id === stopId ? { ...s, details, photo: s.photo ?? gallery[0] } : s));
      return { ...t, stops, coverPhoto: t.coverPhoto ?? stops.find((s) => s.photo)?.photo };
    });
  });
}

function itineraryLines(tour: Tour): string[] {
  const lines: string[] = [];
  const legTo = new Map(tour.legs.map((l) => [l.toId, l]));
  if (tour.start) lines.push(`${formatClock(tour.startAt)} start from the traveler's current location`);
  for (const meal of tour.meals.filter((m) => m.afterStopId === null)) {
    lines.push(`${formatClock(meal.at)} ${meal.kind} near ${meal.nearName}`);
  }
  for (const stop of tour.stops) {
    const leg = legTo.get(stop.id);
    if (leg) lines.push(`${MODE_LABEL[leg.mode].toLowerCase()} ${formatDuration(leg.durationMin)} (${formatDistance(leg.distanceM)})`);
    lines.push(`${formatClock(stop.arriveAt!)} ${stop.name} (${stop.category}, ${stop.durationMin} min): ${stop.summary}`);
    for (const meal of tour.meals.filter((m) => m.afterStopId === stop.id)) {
      lines.push(`${formatClock(meal.at)} ${meal.kind} break near ${meal.nearName} (${meal.durationMin} min)`);
    }
  }
  lines.push(`Tour ends around ${formatClock(tour.endAt)}`);
  return lines;
}

export function ensureTodayIntro(tourId: string): Promise<void> {
  return track(tourId, "today", async () => {
    const tour = await getTour(tourId);
    if (!tour || tour.todayIntro) return;
    const narration = await fetchTodayIntro({
      city: tour.city,
      title: tour.title,
      focus: tour.request.focus,
      focusNotes: tour.request.focusNotes,
      constraints: tour.request.constraints,
      timeAvailable: tour.request.timeAvailable,
      weekday: tour.request.now.weekday,
      itinerary: itineraryLines(tour),
      stopNames: tour.stops.map((s) => s.name),
    });
    await updateTour(tourId, (t) => ({ ...t, todayIntro: narration }));
  });
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ensureRestaurants(tourId: string, force = false): Promise<void> {
  return track(tourId, "restaurants", async () => {
    const tour = await getTour(tourId);
    if (!tour || tour.meals.length === 0 || (tour.restaurants && !force)) return;
    const recs = await fetchRestaurants({
      city: tour.city,
      country: tour.country,
      timeZone: tour.request.now.timeZone,
      constraints: tour.request.constraints,
      slots: tour.meals.slice(0, 5).map((m) => ({
        slotId: m.id,
        kind: m.kind,
        lat: m.near.lat,
        lng: m.near.lng,
        nearName: m.nearName,
        localTime: localHHMM(m.at),
        weekday: new Date(m.at).getDay(),
        weekdayName: WEEKDAYS[new Date(m.at).getDay()],
      })),
    });
    await updateTour(tourId, (t) => ({ ...t, restaurants: recs }));
  });
}

/** Fills whatever is still missing. Safe to call repeatedly. */
export async function ensureTourContent(tourId: string): Promise<void> {
  const tour = await getTour(tourId);
  if (!tour) return;
  const jobs: Promise<void>[] = [ensureTodayIntro(tourId), ensureRestaurants(tourId)];
  const missing = tour.stops.filter((s) => !s.details).map((s) => s.id);
  jobs.push(mapLimit(missing, 3, (id) => ensureStopDetails(tourId, id)).then(() => undefined));
  await Promise.allSettled(jobs);
}

export function useTourTasks(tourId: string | undefined): TaskState {
  const [state, setState] = useState<TaskState>(() => (tourId ? tourTaskState(tourId) : { running: 0, failed: [] }));
  useEffect(() => {
    if (!tourId) return;
    setState(tourTaskState(tourId));
    return onTaskChange(() => setState(tourTaskState(tourId)));
  }, [tourId]);
  return state;
}
