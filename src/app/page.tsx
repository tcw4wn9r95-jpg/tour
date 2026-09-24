"use client";
import { ChevronRight, Compass, MapPinned, MoreHorizontal, Plus, Settings, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Photo } from "@/components/Photo";
import { deleteTour, useTours } from "@/lib/client/store";
import { useConfig } from "@/lib/client/useConfig";
import { formatClock, formatDistance } from "@/lib/geo";
import { FOCUS_EMOJI, FOCUS_LABEL, shortDate } from "@/lib/labels";
import { tourHref } from "@/lib/links";
import type { Tour } from "@/lib/types";

interface CityGroup {
  key: string;
  city: string;
  region: string;
  country: string;
  tours: Tour[];
}

function groupByCity(tours: Tour[]): CityGroup[] {
  const groups = new Map<string, CityGroup>();
  for (const t of tours) {
    const key = `${t.city}|${t.country}`.toLowerCase();
    const g = groups.get(key) ?? { key, city: t.city, region: t.region, country: t.country, tours: [] };
    g.tours.push(t);
    groups.set(key, g);
  }
  // tours arrive newest first, so groups keep "most recently used city" order
  return [...groups.values()];
}

export default function Home() {
  const tours = useTours();
  const config = useConfig();
  const groups = useMemo(() => groupByCity(tours ?? []), [tours]);
  // Set after mount: this page is prerendered, so a render-time date would be the build date.
  const [today, setToday] = useState("");
  useEffect(() => setToday(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })), []);

  return (
    <main className="pt-safe mx-auto min-h-dvh max-w-xl pb-40">
      <header className="flex items-end justify-between px-5 pt-6">
        <div>
          <p className="h-5 text-[13px] font-semibold uppercase tracking-wide text-muted">{today}</p>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-tight">My Tours</h1>
        </div>
        <Link href="/settings" aria-label="Settings" className="mb-1.5 flex size-10 items-center justify-center rounded-full bg-card text-muted active:opacity-70">
          <Settings className="size-5" />
        </Link>
      </header>

      {config?.demo &&
        (config.keysOnDevice ? (
          <Link href="/settings" className="mx-4 mt-4 flex gap-3 rounded-2xl bg-accent-soft p-4 text-sm active:opacity-80">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" />
            <p>
              <b>Add your Anthropic API key</b> in Settings to have Claude plan real tours. Until then you&apos;ll get a sample Lisbon day.{" "}
              <span className="font-semibold text-accent">Open Settings ›</span>
            </p>
          </Link>
        ) : (
          <div className="mx-4 mt-4 flex gap-3 rounded-2xl bg-accent-soft p-4 text-sm">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" />
            <p>
              <b>Demo mode.</b> Add an <code className="rounded bg-card px-1">ANTHROPIC_API_KEY</code> on the server to have Claude plan real tours.
              Until then you&apos;ll get a sample Lisbon day.
            </p>
          </div>
        ))}

      {tours === null ? (
        <div className="mx-4 mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-3xl bg-card" />
          ))}
        </div>
      ) : tours.length === 0 ? (
        <EmptyState />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mt-7">
            <div className="flex items-end justify-between px-5">
              <div>
                <h2 className="flex items-center gap-1.5 font-display text-[22px] font-bold">
                  <MapPinned className="size-5 text-accent" /> {g.city}
                </h2>
                <p className="text-sm text-muted">{[g.region, g.country].filter((x) => x && x !== g.city).join(" · ")}</p>
              </div>
              <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-muted">
                {g.tours.length} {g.tours.length === 1 ? "tour" : "tours"}
              </span>
            </div>
            <div className="mt-3 space-y-3 px-4">
              {g.tours.map((t) => (
                <TourCard key={t.id} tour={t} />
              ))}
            </div>
          </section>
        ))
      )}

      <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center" style={{ bottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
        <Link
          href="/new"
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[17px] font-semibold text-white shadow-[0_8px_24px_rgba(240,83,45,0.4)] active:scale-[0.98]"
        >
          <Plus className="size-5" strokeWidth={2.6} /> New tour
        </Link>
      </div>
    </main>
  );
}

function TourCard({ tour }: { tour: Tour }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-card shadow-sm">
      <Link href={tourHref(tour.id)} className="block active:opacity-90">
        <div className="relative h-44">
          <Photo photo={tour.coverPhoto} category={tour.stops[0]?.category} alt={tour.title} className="h-full w-full" hideIcon />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute inset-x-4 bottom-3 text-white">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/75">{shortDate(tour.startAt)}</div>
            <div className="font-display text-xl font-bold leading-snug">{tour.title}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {tour.request.focus.map((f) => (
                <span key={f} className="rounded-full bg-chip px-2 py-0.5 text-xs font-medium">
                  {FOCUS_EMOJI[f]} {FOCUS_LABEL[f]}
                </span>
              ))}
            </div>
            <div className="mt-1.5 text-sm text-muted">
              {tour.stops.length} stops · {formatDistance(tour.totalDistanceM)} · {formatClock(tour.startAt)}–{formatClock(tour.endAt)}
            </div>
          </div>
          <ChevronRight className="size-5 text-muted" />
        </div>
      </Link>
      <button
        aria-label="Tour options"
        onClick={() => setMenu((m) => !m)}
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {menu && (
        <div className="absolute right-3 top-12 z-10 overflow-hidden rounded-xl border border-line bg-card shadow-xl">
          <button
            onClick={() => {
              if (confirm(`Delete "${tour.title}"?`)) void deleteTour(tour.id);
              setMenu(false);
            }}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-red-500"
          >
            <Trash2 className="size-4" /> Delete tour
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-4 mt-10 flex flex-col items-center rounded-3xl bg-card px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft">
        <Compass className="size-9 text-accent" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold">Where are we exploring?</h2>
      <p className="mt-2 max-w-xs text-muted">
        Tell your guide what you love and how much time you have. You&apos;ll get a personal route, a live map and audio stories for
        every stop.
      </p>
      <Link href="/new" className="mt-6 rounded-full bg-accent px-6 py-3 font-semibold text-white active:opacity-80">
        Plan my first tour
      </Link>
    </div>
  );
}
