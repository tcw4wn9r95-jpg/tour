import type { LatLng, LegMode } from "./types";

const EARTH_RADIUS_M = 6_371_000;

export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) return { lat: 0, lng: 0 };
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

export function formatDistance(m: number): string {
  if (m < 950) return `${Math.max(50, Math.round(m / 50) * 50)} m`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`;
}

export function formatDuration(min: number): string {
  const rounded = Math.max(1, Math.round(min));
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatClock(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export const MODE_LABEL: Record<LegMode, string> = {
  walk: "Walk",
  transit: "Public transport",
  car: "Car / taxi",
};

const APPLE_DIRFLG: Record<LegMode, string> = { walk: "w", transit: "r", car: "d" };
const GOOGLE_MODE: Record<LegMode, string> = { walk: "walking", transit: "transit", car: "driving" };

/** Opens turn-by-turn directions in Apple Maps (the Maps app on iPhone). */
export function appleDirectionsUrl(to: LatLng, mode: LegMode, from?: LatLng): string {
  const params = new URLSearchParams({ daddr: `${to.lat},${to.lng}`, dirflg: APPLE_DIRFLG[mode] });
  if (from) params.set("saddr", `${from.lat},${from.lng}`);
  return `https://maps.apple.com/?${params.toString()}`;
}

export function googleDirectionsUrl(to: LatLng, mode: LegMode, from?: LatLng): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${to.lat},${to.lng}`,
    travelmode: GOOGLE_MODE[mode],
  });
  if (from) params.set("origin", `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function appleSearchUrl(name: string, near?: LatLng | null): string {
  const params = new URLSearchParams({ q: name });
  if (near) params.set("ll", `${near.lat},${near.lng}`);
  return `https://maps.apple.com/?${params.toString()}`;
}
