"use client";
import { ArrowRight, Clock, Footprints, Lightbulb, ListChecks, MapPin, Quote } from "lucide-react";
import Link from "next/link";
import { Photo } from "@/components/Photo";
import { TourMapLazy } from "@/components/TourMapLazy";
import { formatClock, formatDistance } from "@/lib/geo";
import { CATEGORY_LABEL, FOCUS_EMOJI, FOCUS_LABEL } from "@/lib/labels";
import type { Tour } from "@/lib/types";
import { LegRow, RouteLegend } from "./LegRow";

export function Overview({ tour, onStart }: { tour: Tour; onStart: () => void }) {
  const legTo = new Map(tour.legs.map((l) => [l.toId, l]));
  return (
    <div className="pb-8">
      <div className="relative h-72">
        <Photo photo={tour.coverPhoto} category={tour.stops[0]?.category} alt={tour.city} className="h-full w-full" hideIcon />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
        <div className="absolute inset-x-5 bottom-5 text-white">
          <div className="flex items-center gap-1 text-sm font-semibold text-white/80">
            <MapPin className="size-4" /> {tour.city}, {tour.country}
          </div>
          <h1 className="mt-1 font-display text-[28px] font-bold leading-tight">{tour.title}</h1>
          <p className="mt-1 text-white/85">{tour.subtitle}</p>
        </div>
      </div>

      <div className="mx-4 -mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl bg-card py-3 text-center shadow-sm relative">
        <Stat label="Stops" value={String(tour.stops.length)} />
        <Stat label="Travel" value={formatDistance(tour.totalDistanceM)} />
        <Stat label="Time" value={`${formatClock(tour.startAt)}–${formatClock(tour.endAt)}`} small />
      </div>

      <section className="mx-4 mt-5 rounded-3xl bg-card p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
          <Quote className="size-4" /> From your guide
        </div>
        <p className="mt-2 font-serif text-[21px] italic leading-snug">&ldquo;{tour.intro.headline}&rdquo;</p>
        <div className="mt-3 space-y-3 text-[16px] leading-relaxed">
          {tour.intro.welcome.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tour.request.focus.map((f) => (
            <span key={f} className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
              {FOCUS_EMOJI[f]} {FOCUS_LABEL[f]}
            </span>
          ))}
          {tour.intro.themes.map((t) => (
            <span key={t} className="rounded-full bg-chip px-3 py-1 text-sm">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-4 mt-5">
        <h2 className="mb-2 px-1 font-display text-xl font-bold">Your route</h2>
        <TourMapLazy tour={tour} className="h-[380px] rounded-3xl" />
        <div className="mt-2 px-1">
          <RouteLegend />
        </div>
        <div className="mt-3 rounded-3xl bg-card px-3 py-2">
          {tour.start && (
            <div className="flex items-center gap-3 py-1.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-fg text-xs font-bold text-bg">S</span>
              <span className="text-sm font-medium">Your location · {formatClock(tour.startAt)}</span>
            </div>
          )}
          {tour.stops.map((s, i) => {
            const leg = legTo.get(s.id);
            return (
              <div key={s.id}>
                {leg && <LegRow leg={leg} to={s} compact />}
                <Link href={`/tour/${tour.id}/stop/${s.id}`} className="flex items-center gap-3 py-1.5 active:opacity-70">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${s.visited ? "bg-good" : "bg-accent"}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block text-xs text-muted">
                      {s.arriveAt ? formatClock(s.arriveAt) : ""} · {CATEGORY_LABEL[s.category]} · {s.durationMin} min
                    </span>
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <InfoList icon={<ListChecks className="size-4" />} title="What to expect" items={tour.intro.whatToExpect} />
      <InfoList icon={<Lightbulb className="size-4" />} title="Local tips" items={tour.tips} />

      <div className="mx-4 mt-6">
        <button onClick={onStart} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-[17px] font-semibold text-white active:opacity-85">
          <Footprints className="size-5" /> Start today&apos;s tour <ArrowRight className="size-5" />
        </button>
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted">
          <Clock className="size-3.5" /> Planned {tour.request.now.weekday} at {tour.request.now.time} for &ldquo;{tour.request.timeAvailable}&rdquo;
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="px-2">
      <div className={`font-display font-bold ${small ? "text-[15px] leading-6" : "text-xl"}`}>{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function InfoList({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="mx-4 mt-5 rounded-3xl bg-card p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <span className="text-accent">{icon}</span> {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-snug">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}
