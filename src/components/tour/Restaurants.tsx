"use client";
import { MapPin, RefreshCw, Star } from "lucide-react";
import { withPasscode } from "@/lib/client/api";
import { formatClock, formatDistance } from "@/lib/geo";
import { MEAL_EMOJI, MEAL_LABEL } from "@/lib/labels";
import type { MealRecommendation, MealSlot, Restaurant } from "@/lib/types";

const SOURCE: Record<MealRecommendation["source"], string> = {
  google: "Top rated on Google near your route",
  web: "Top rated by travelers (researched by Claude)",
  claude: "Suggested by your guide",
};

export function MealBreak({
  slot,
  rec,
  loading,
  failed,
  onRetry,
}: {
  slot: MealSlot;
  rec?: MealRecommendation;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-car/60 bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-xl">{MEAL_EMOJI[slot.kind]}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {MEAL_LABEL[slot.kind]} · {formatClock(slot.at)}
          </div>
          <div className="truncate text-xs text-muted">
            ~{slot.durationMin} min near {slot.nearName}
          </div>
        </div>
      </div>
      {rec && rec.restaurants.length > 0 ? (
        <>
          <div className="scrollbar-none -mx-3.5 mt-3 flex snap-x gap-3 overflow-x-auto px-3.5 pb-1">
            {rec.restaurants.map((r) => (
              <RestaurantCard key={r.name} r={r} />
            ))}
          </div>
          <div className="mt-1.5 text-[11px] text-muted">{rec.note ?? SOURCE[rec.source]}</div>
        </>
      ) : loading ? (
        <div className="mt-3 flex gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 w-56 shrink-0 animate-pulse rounded-xl bg-card-2" />
          ))}
        </div>
      ) : failed ? (
        <button onClick={onRetry} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent">
          <RefreshCw className="size-4" /> Couldn&apos;t load restaurant picks — retry
        </button>
      ) : (
        <p className="mt-2 text-sm text-muted">No highly rated places open nearby at that time.</p>
      )}
    </div>
  );
}

function RestaurantCard({ r }: { r: Restaurant }) {
  return (
    <a href={r.mapsUrl} target="_blank" rel="noreferrer" className="w-60 shrink-0 snap-start overflow-hidden rounded-xl bg-card-2 active:opacity-80">
      {r.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={withPasscode(r.photoUrl)} alt={r.name} loading="lazy" className="h-24 w-full object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-orange-300 to-rose-400 text-3xl">🍽️</div>
      )}
      <div className="p-2.5">
        <div className="truncate font-semibold">{r.name}</div>
        <div className="mt-0.5 flex items-center gap-1 text-xs">
          {r.rating != null ? (
            <>
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <b>{r.rating.toFixed(1)}</b>
              {r.reviewCount ? <span className="text-muted">({r.reviewCount.toLocaleString()})</span> : null}
              <span className="text-muted">· {r.ratingSource}</span>
            </>
          ) : (
            <span className="text-muted">No rating found</span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {[r.priceLevel, r.cuisine].filter(Boolean).join(" · ")}
          {r.openNow === false ? " · may be closed" : ""}
        </div>
        {r.why && <div className="mt-1 line-clamp-2 text-xs">{r.why}</div>}
        {r.distanceM != null && (
          <div className="mt-1 flex items-center gap-1 text-xs font-medium text-accent">
            <MapPin className="size-3" /> {formatDistance(r.distanceM)} from the route
          </div>
        )}
      </div>
    </a>
  );
}
