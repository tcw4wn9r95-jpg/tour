"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Maximize2, Minimize2, Route } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { formatClock, formatDistance, formatDuration, MODE_LABEL } from "@/lib/geo";
import type { LatLng, LegMode, Tour } from "@/lib/types";

// OpenStreetMap's own tiles need no key (fine for personal use). Set
// NEXT_PUBLIC_TILE_URL (+ _ATTRIBUTION) to use MapTiler, Stadia, Mapbox, etc.
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const MODE_COLOR: Record<LegMode, string> = { walk: "#0a84ff", transit: "#8b5cf6", car: "#ff9500" };
const MODE_DASH: Record<LegMode, string | undefined> = { walk: "1 9", transit: "10 10", car: undefined };

function stopIcon(n: number, visited: boolean, active: boolean) {
  const bg = visited ? "#30b158" : active ? "#111114" : "#f0532d";
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
    html: `<div style="width:30px;height:30px;border-radius:999px;background:${bg};color:#fff;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:700 13px -apple-system,system-ui,sans-serif">${n}</div>`,
  });
}

const startIcon = L.divIcon({
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<div style="width:24px;height:24px;border-radius:8px;background:#111114;color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font:700 11px system-ui">S</div>`,
});

const foodIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -10],
  html: `<div style="width:22px;height:22px;border-radius:999px;background:#fff;border:2px solid #ff9500;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,.25)">🍴</div>`,
});

const meIcon = L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: `<div class="me-dot"></div>` });

function FitTo({ points, trigger }: { points: LatLng[]; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, trigger]);
  return null;
}

function Recenter({ target }: { target: { p: LatLng; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.p.lat, target.p.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, target]);
  return null;
}

function InvalidateOnResize({ expanded }: { expanded: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map, expanded]);
  return null;
}

export default function TourMap({ tour, className = "", focusStopId }: { tour: Tour; className?: string; focusStopId?: string }) {
  const [me, setMe] = useState<{ p: LatLng; accuracy: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [recenter, setRecenter] = useState<{ p: LatLng; n: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setMe({ p: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy: pos.coords.accuracy });
        setLocError(null);
      },
      (err) => setLocError(err.code === err.PERMISSION_DENIED ? "Location is off — enable it in Settings › Safari › Location." : null),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const points = useMemo(() => {
    const pts: LatLng[] = tour.stops.map((s) => ({ lat: s.lat, lng: s.lng }));
    if (tour.start) pts.push(tour.start);
    return pts;
  }, [tour]);

  const byId = useMemo(() => {
    const m = new Map<string, LatLng>(tour.stops.map((s) => [s.id, s]));
    if (tour.start) m.set("start", tour.start);
    return m;
  }, [tour]);

  const restaurants = (tour.restaurants ?? []).flatMap((r) => r.restaurants.filter((x) => x.lat != null && x.lng != null));

  return (
    <div className={expanded ? "fixed inset-0 z-[1200] bg-bg" : `relative overflow-hidden ${className}`}>
      <MapContainer
        center={[tour.center.lat, tour.center.lng]}
        zoom={14}
        zoomControl={false}
        attributionControl
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <FitTo points={points} trigger={fitTrigger} />
        <Recenter target={recenter} />
        <InvalidateOnResize expanded={expanded} />

        {tour.legs.map((leg) => {
          const a = byId.get(leg.fromId);
          const b = byId.get(leg.toId);
          if (!a || !b) return null;
          const path: [number, number][] = leg.path ?? [
            [a.lat, a.lng],
            [b.lat, b.lng],
          ];
          return (
            <Fragment key={`${leg.fromId}-${leg.toId}`}>
              <Polyline positions={path} pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.85, lineCap: "round" }} />
              <Polyline positions={path} pathOptions={{ color: MODE_COLOR[leg.mode], weight: 5, dashArray: MODE_DASH[leg.mode], lineCap: "round" }}>
                <Popup>
                  <b>{MODE_LABEL[leg.mode]}</b> · {formatDuration(leg.durationMin)} · {formatDistance(leg.distanceM)}
                </Popup>
              </Polyline>
            </Fragment>
          );
        })}

        {restaurants.map((r) => (
          <Marker key={`${r.name}-${r.lat}`} position={[r.lat!, r.lng!]} icon={foodIcon}>
            <Popup>
              <b>{r.name}</b>
              <br />
              {r.rating ? `★ ${r.rating.toFixed(1)}` : ""} {r.cuisine}
            </Popup>
          </Marker>
        ))}

        {tour.start && <Marker position={[tour.start.lat, tour.start.lng]} icon={startIcon} />}

        {tour.stops.map((s, i) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={stopIcon(i + 1, Boolean(s.visited), s.id === focusStopId)} zIndexOffset={s.id === focusStopId ? 1000 : 0}>
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {i + 1}. {s.name}
                </div>
                {s.arriveAt && <div style={{ color: "#6c6c76", margin: "2px 0 6px" }}>{formatClock(s.arriveAt)} · {s.durationMin} min</div>}
                <Link href={`/tour/${tour.id}/stop/${s.id}`} style={{ color: "#f0532d", fontWeight: 600 }}>
                  Open guide →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}

        {me && (
          <>
            {me.accuracy < 300 && <Circle center={[me.p.lat, me.p.lng]} radius={me.accuracy} pathOptions={{ color: "#0a84ff", weight: 1, fillOpacity: 0.08 }} />}
            <Marker position={[me.p.lat, me.p.lng]} icon={meIcon} zIndexOffset={2000} />
          </>
        )}
      </MapContainer>

      <div className="absolute right-3 z-[1000] flex flex-col gap-2" style={{ top: expanded ? "calc(env(safe-area-inset-top) + 12px)" : 12 }}>
        <MapButton label={expanded ? "Close full screen" : "Full screen"} onClick={() => setExpanded((e) => !e)}>
          {expanded ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </MapButton>
        <MapButton label="Show whole route" onClick={() => setFitTrigger((n) => n + 1)}>
          <Route className="size-5" />
        </MapButton>
        <MapButton
          label="Show my location"
          onClick={() => (me ? setRecenter({ p: me.p, n: Date.now() }) : setLocError("Waiting for your location…"))}
        >
          <LocateFixed className={`size-5 ${me ? "text-walk" : ""}`} />
        </MapButton>
      </div>
      {locError && (
        <div className="absolute inset-x-3 bottom-3 z-[1000] rounded-xl bg-black/75 px-3 py-2 text-center text-xs text-white">{locError}</div>
      )}
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-xl border border-line bg-card/95 text-fg shadow-md backdrop-blur active:scale-95"
    >
      {children}
    </button>
  );
}
