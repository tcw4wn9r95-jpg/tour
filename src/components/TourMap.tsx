"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Maximize2, Minimize2, Navigation, Route } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { formatClock, formatDistance, formatDuration, haversine, MODE_LABEL } from "@/lib/geo";
import { stopHref } from "@/lib/links";
import type { LatLng, LegMode, Tour } from "@/lib/types";

// OpenStreetMap's own tiles need no key (fine for personal use). Set
// NEXT_PUBLIC_TILE_URL (+ _ATTRIBUTION) to use MapTiler, Stadia, Mapbox, etc.
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const MODE_COLOR: Record<LegMode, string> = { walk: "#0a84ff", transit: "#8b5cf6", car: "#ff9500" };
const MODE_DASH: Record<LegMode, string | undefined> = { walk: "1 9", transit: "10 10", car: undefined };

/** Pins shrink when zoomed out so neighbouring stops don't pile on top of each other. */
function pinSize(zoom: number): number {
  if (zoom >= 15) return 30;
  if (zoom >= 13.5) return 24;
  return 19;
}

function stopIcon(n: number, visited: boolean, active: boolean, size: number) {
  const bg = visited ? "#30b158" : active ? "#111114" : "#f0532d";
  const border = size >= 24 ? 2.5 : 2;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${bg};color:#fff;border:${border}px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:700 ${Math.round(size * 0.44)}px -apple-system,system-ui,sans-serif">${n}</div>`,
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

const curiosityIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -10],
  html: `<div style="width:22px;height:22px;border-radius:999px;background:#fff7e0;border:2px solid #f5b100;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 1px 4px rgba(0,0,0,.25)">✨</div>`,
});

const meIcon = L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: `<div class="me-dot"></div>` });

type Frame = { points: LatLng[]; maxZoom: number };

/**
 * Keeps the frame in view: on first layout, whenever the container changes size
 * (full screen, rotation, late layout) and when asked to, but stops following
 * once the traveller pans or zooms the map themselves.
 */
function Framer({ frame, trigger, onZoom }: { frame: Frame; trigger: number; onZoom: (z: number) => void }) {
  const map = useMap();
  const userMoved = useRef(false);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const fit = () => {
    const pts = frameRef.current.points;
    if (pts.length === 0) return;
    map.invalidateSize({ pan: false });
    const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number]));
    // Extra room on the right for the map buttons.
    map.fitBounds(bounds, { paddingTopLeft: [28, 36], paddingBottomRight: [64, 36], maxZoom: frameRef.current.maxZoom, animate: false });
  };

  useMapEvents({
    dragstart: () => (userMoved.current = true),
    zoomend: () => onZoom(map.getZoom()),
  });

  useEffect(() => {
    const container = map.getContainer();
    const markUser = () => (userMoved.current = true);
    const onTouch = (e: TouchEvent) => e.touches.length > 1 && markUser(); // pinch
    container.addEventListener("wheel", markUser, { passive: true });
    container.addEventListener("touchstart", onTouch, { passive: true });
    const observer = new ResizeObserver(() => {
      if (userMoved.current) map.invalidateSize();
      else fit();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      container.removeEventListener("wheel", markUser);
      container.removeEventListener("touchstart", onTouch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    userMoved.current = false;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return null;
}

function Recenter({ target }: { target: { p: LatLng; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.p.lat, target.p.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, target]);
  return null;
}

export default function TourMap({
  tour,
  className = "",
  focusStopId,
  focus = "route",
}: {
  tour: Tour;
  className?: string;
  focusStopId?: string;
  /** "route": the whole day. "next": street-level view of the way to the next unvisited stop. */
  focus?: "route" | "next";
}) {
  const [me, setMe] = useState<{ p: LatLng; accuracy: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [mode, setMode] = useState(focus);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [recenter, setRecenter] = useState<{ p: LatLng; n: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(14);

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

  const byId = useMemo(() => {
    const m = new Map<string, LatLng>(tour.stops.map((s) => [s.id, s]));
    if (tour.start) m.set("start", tour.start);
    return m;
  }, [tour]);

  const nextIndex = tour.stops.findIndex((s) => !s.visited);
  const nextStop = nextIndex >= 0 ? tour.stops[nextIndex] : undefined;
  const hasMe = me !== null;

  const frame = useMemo<Frame>(() => {
    const route: LatLng[] = tour.stops.map((s) => ({ lat: s.lat, lng: s.lng }));
    if (tour.start) route.push(tour.start);
    if (mode === "route" || !nextStop) return { points: route, maxZoom: 16 };
    // Where you are (if you're nearby) or the previous stop, plus the next stop.
    const from = me && haversine(me.p, nextStop) < 3000 ? me.p : nextIndex > 0 ? tour.stops[nextIndex - 1] : (tour.start ?? null);
    return { points: [nextStop, ...(from ? [from] : [])], maxZoom: 17 };
    // Re-frame when the next stop changes or location first arrives, not on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, mode, nextStop?.id, hasMe]);

  useEffect(() => setFitTrigger((n) => n + 1), [frame]);

  const restaurants = (tour.restaurants ?? []).flatMap((r) => r.restaurants.filter((x) => x.lat != null && x.lng != null));
  const curiosities = (tour.curiosities ?? []).filter((c) => c.lat != null && c.lng != null);
  const size = pinSize(zoom);

  return (
    <div className={expanded ? "fixed inset-0 z-[1200] bg-bg" : `relative overflow-hidden ${className}`}>
      <MapContainer
        center={[tour.center.lat, tour.center.lng]}
        zoom={14}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={120}
        zoomControl={false}
        attributionControl
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <Framer frame={frame} trigger={fitTrigger} onZoom={setZoom} />
        <Recenter target={recenter} />

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

        {curiosities.map((c) => (
          <Marker key={c.id} position={[c.lat!, c.lng!]} icon={curiosityIcon}>
            <Popup>
              <div style={{ maxWidth: 220 }}>
                <b>{c.title}</b>
                <div style={{ margin: "4px 0" }}>{c.lookFor}</div>
                <div style={{ color: "#6c6c76", fontSize: 11 }}>via {c.sourceName}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {tour.start && <Marker position={[tour.start.lat, tour.start.lng]} icon={startIcon} />}

        {tour.stops.map((s, i) => {
          const active = s.id === focusStopId || (mode === "next" && s.id === nextStop?.id);
          return (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={stopIcon(i + 1, Boolean(s.visited), active, size)} zIndexOffset={active ? 1000 : 0}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {i + 1}. {s.name}
                  </div>
                  {s.arriveAt && <div style={{ color: "#6c6c76", margin: "2px 0 6px" }}>{formatClock(s.arriveAt)} · {s.durationMin} min</div>}
                  <Link href={stopHref(tour.id, s.id)} style={{ color: "#f0532d", fontWeight: 600 }}>
                    Open guide →
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}

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
        <MapButton
          label="Show whole route"
          active={mode === "route"}
          onClick={() => {
            setMode("route");
            setFitTrigger((n) => n + 1);
          }}
        >
          <Route className="size-5" />
        </MapButton>
        {nextStop && (
          <MapButton
            label="Zoom to next stop"
            active={mode === "next"}
            onClick={() => {
              setMode("next");
              setFitTrigger((n) => n + 1);
            }}
          >
            <Navigation className="size-5" />
          </MapButton>
        )}
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

function MapButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex size-10 items-center justify-center rounded-xl border shadow-md backdrop-blur active:scale-95 ${
        active ? "border-accent bg-accent text-white" : "border-line bg-card/95 text-fg"
      }`}
    >
      {children}
    </button>
  );
}
