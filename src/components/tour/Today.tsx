"use client";
import { Check, ChevronRight, Flag, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { EpisodeCard, PlayChip } from "@/components/Narration";
import { Photo } from "@/components/Photo";
import { ensureRestaurants, ensureTodayIntro, useTourTasks } from "@/lib/client/enrich";
import { updateTour } from "@/lib/client/store";
import { formatClock } from "@/lib/geo";
import { CATEGORY_LABEL } from "@/lib/labels";
import { stopHref, tourHref } from "@/lib/links";
import type { Stop, Tour } from "@/lib/types";
import { LegRow } from "./LegRow";
import { MealBreak } from "./Restaurants";

export function Today({ tour }: { tour: Tour }) {
  const tasks = useTourTasks(tour.id);
  const legTo = new Map(tour.legs.map((l) => [l.toId, l]));
  const pointOf = (id: string) => (id === "start" ? tour.start : tour.stops.find((s) => s.id === id));
  const visited = tour.stops.filter((s) => s.visited).length;
  const date = new Date(tour.startAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const introFailed = tasks.failed.includes("today");
  const restaurantsLoading = !tour.restaurants && !tasks.failed.includes("restaurants");
  const restaurantsFailed = tasks.failed.includes("restaurants");

  const meals = (afterStopId: string | null) =>
    tour.meals
      .filter((m) => m.afterStopId === afterStopId)
      .map((m) => (
        <div key={m.id} className="py-1.5 pl-2">
          <MealBreak
            slot={m}
            rec={tour.restaurants?.find((r) => r.slotId === m.id)}
            loading={restaurantsLoading}
            failed={restaurantsFailed}
            onRetry={() => void ensureRestaurants(tour.id, true)}
          />
        </div>
      ));

  return (
    <div className="px-4 pb-8 pt-4">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">{date}</p>
      <h1 className="font-display text-[32px] font-bold leading-tight">Today&apos;s tour</h1>
      <p className="text-muted">
        {tour.stops.length} stops · {formatClock(tour.startAt)}–{formatClock(tour.endAt)}
        {visited > 0 ? ` · ${visited} visited` : ""}
      </p>

      <div className="mt-4">
        {tour.todayIntro ? (
          <EpisodeCard
            kicker="Start here · your guide's welcome"
            track={{
              id: `${tour.id}:today`,
              title: tour.todayIntro.title,
              subtitle: tour.title,
              narration: tour.todayIntro,
              artwork: tour.coverPhoto?.url,
              href: tourHref(tour.id, "today"),
            }}
          />
        ) : (
          <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-[#2b1b4a] via-[#4a2150] to-[#a8452f] p-5 text-white">
            {introFailed ? (
              <button onClick={() => void ensureTodayIntro(tour.id)} className="flex items-center gap-2 font-semibold">
                <RefreshCw className="size-5" /> Couldn&apos;t prepare the welcome audio — tap to retry
              </button>
            ) : (
              <>
                <Loader2 className="size-6 animate-spin" />
                <div>
                  <div className="font-semibold">Your guide is preparing today&apos;s welcome…</div>
                  <div className="text-sm text-white/70">A one-minute audio intro to your day</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        {tour.start && (
          <div className="flex items-center gap-3">
            <span className="flex size-[34px] items-center justify-center rounded-xl bg-fg text-bg">
              <Flag className="size-4" />
            </span>
            <div>
              <div className="font-semibold">Start from your location</div>
              <div className="text-sm text-muted">{formatClock(tour.startAt)}</div>
            </div>
          </div>
        )}
        {meals(null)}
        {tour.stops.map((stop, i) => {
          const leg = legTo.get(stop.id);
          const from = leg ? pointOf(leg.fromId) : undefined;
          return (
            <div key={stop.id}>
              {leg && <LegRow leg={leg} from={from ?? undefined} to={stop} />}
              <StopCard tour={tour} stop={stop} index={i} />
              {meals(stop.id)}
            </div>
          );
        })}
        <div className="mt-3 flex items-center gap-3 pl-0.5">
          <span className="flex size-[34px] items-center justify-center rounded-full bg-good text-white">
            <Check className="size-5" />
          </span>
          <div className="text-sm">
            <div className="font-semibold">Tour ends around {formatClock(tour.endAt)}</div>
            <div className="text-muted">Tap a stop for the full guide and audio stories.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StopCard({ tour, stop, index }: { tour: Tour; stop: Stop; index: number }) {
  const href = stopHref(tour.id, stop.id);
  const toggleVisited = () =>
    void updateTour(tour.id, (t) => ({ ...t, stops: t.stops.map((s) => (s.id === stop.id ? { ...s, visited: !s.visited } : s)) }));

  return (
    <div className={`overflow-hidden rounded-3xl bg-card shadow-sm ${stop.visited ? "opacity-75" : ""}`}>
      <Link href={href} className="block active:opacity-90">
        <div className="relative h-48">
          <Photo photo={stop.photo} category={stop.category} alt={stop.name} className="h-full w-full" iconClass="size-12" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <span className={`absolute left-3 top-3 flex size-9 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow ${stop.visited ? "bg-good" : "bg-accent"}`}>
            {stop.visited ? <Check className="size-5" /> : index + 1}
          </span>
          <div className="absolute inset-x-4 bottom-3 text-white">
            <div className="text-xs font-semibold text-white/80">
              {stop.arriveAt && `${formatClock(stop.arriveAt)}–${formatClock(stop.departAt!)}`} · {CATEGORY_LABEL[stop.category]}
            </div>
            <div className="font-display text-xl font-bold leading-tight">{stop.name}</div>
          </div>
        </div>
      </Link>
      <div className="p-4">
        <p className="text-[15px] leading-snug">{stop.summary}</p>
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-accent">For you: </span>
          {stop.whyForYou}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {stop.details ? (
            <PlayChip
              track={{
                id: `${tour.id}:${stop.id}`,
                title: stop.details.narration.title || stop.name,
                subtitle: `Stop ${index + 1} · ${tour.title}`,
                narration: stop.details.narration,
                artwork: stop.photo?.url,
                href,
              }}
            />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1.5 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Preparing audio guide
            </span>
          )}
          <button
            onClick={toggleVisited}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${stop.visited ? "bg-good/15 text-good" : "bg-chip"}`}
          >
            {stop.visited ? "✓ Visited" : "Mark visited"}
          </button>
          <Link href={href} className="ml-auto flex items-center text-sm font-semibold text-accent">
            Guide <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
