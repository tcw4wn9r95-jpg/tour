"use client";
import { Bus, Car, Footprints, Navigation } from "lucide-react";
import { appleDirectionsUrl, formatDistance, formatDuration, MODE_LABEL } from "@/lib/geo";
import type { LatLng, Leg } from "@/lib/types";

const ICON = { walk: Footprints, transit: Bus, car: Car };
const COLOR = { walk: "text-walk", transit: "text-transit", car: "text-car" };

export function LegRow({ leg, from, to, compact }: { leg: Leg; from?: LatLng; to: LatLng; compact?: boolean }) {
  const Icon = ICON[leg.mode];
  const text = leg.mode === "walk" ? `${formatDuration(leg.durationMin)} walk` : `~${formatDuration(leg.durationMin)} by ${MODE_LABEL[leg.mode].toLowerCase()}`;
  return (
    <div className={`flex items-center gap-2 ${compact ? "py-1" : "py-2"} pl-[15px]`}>
      <div className={`flex w-8 justify-center ${COLOR[leg.mode]}`}>
        <div className={`h-8 border-l-[3px] ${leg.mode === "walk" ? "border-dotted" : leg.mode === "transit" ? "border-dashed" : "border-solid"} border-current`} />
      </div>
      <Icon className={`size-4 ${COLOR[leg.mode]}`} />
      <span className="text-sm text-muted">
        {text} · {formatDistance(leg.distanceM)}
      </span>
      {!compact && (
        <a
          href={appleDirectionsUrl(to, leg.mode, from)}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1 rounded-full bg-chip px-3 py-1 text-xs font-semibold text-fg active:opacity-70"
        >
          <Navigation className="size-3" /> Directions
        </a>
      )}
    </div>
  );
}

export function RouteLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="w-5 border-t-[3px] border-dotted border-walk" /> Walk (&lt; 1 km)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-5 border-t-[3px] border-dashed border-transit" /> Public transport
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-5 border-t-[3px] border-car" /> Car / taxi
      </span>
      <span className="flex items-center gap-1.5">🍴 Restaurant picks</span>
    </div>
  );
}
