"use client";
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock, Eye, Loader2, Navigation, RefreshCw, Sparkles, Ticket, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { EpisodeCard, PlayChip } from "@/components/Narration";
import { Photo } from "@/components/Photo";
import { CuriosityGroup } from "@/components/tour/Curiosities";
import { ensureStopDetails, useTourTasks } from "@/lib/client/enrich";
import { updateTour, useTour } from "@/lib/client/store";
import { appleDirectionsUrl, formatClock, formatDistance, formatDuration, MODE_LABEL } from "@/lib/geo";
import { CATEGORY_LABEL, hasAudioGuide } from "@/lib/labels";
import { stopHref, tourHref } from "@/lib/links";
import type { Photo as PhotoT } from "@/lib/types";

export default function StopPage() {
  // useSearchParams needs a Suspense boundary so the page can be prerendered.
  return (
    <Suspense fallback={<Spinner />}>
      <StopRoute />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted" />
    </div>
  );
}

function StopRoute() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const stopId = params.get("stop") ?? "";
  // Remount per stop so the gallery and scroll position reset on prev/next.
  return <StopScreen key={`${id}:${stopId}`} id={id} stopId={stopId} />;
}

function StopScreen({ id, stopId }: { id: string; stopId: string }) {
  const tour = useTour(id);
  const tasks = useTourTasks(id);

  useEffect(() => {
    if (id && stopId) void ensureStopDetails(id, stopId);
  }, [id, stopId]);

  if (tour === undefined) return <Spinner />;
  const index = tour?.stops.findIndex((s) => s.id === stopId) ?? -1;
  const stop = index >= 0 ? tour!.stops[index] : undefined;
  if (!tour || !stop) {
    return (
      <div className="pt-safe flex min-h-dvh flex-col items-center justify-center gap-3">
        <p className="font-semibold">Stop not found.</p>
        <Link href={tour ? tourHref(tour.id) : "/"} className="text-accent">
          Back
        </Link>
      </div>
    );
  }

  const d = stop.details;
  // Audio is recorded for major landmarks only, never for food stops.
  const audio = hasAudioGuide(stop);
  const isFood = stop.category === "food" || stop.category === "market";
  const failed = tasks.failed.includes(`stop:${stop.id}`);
  const legIn = tour.legs.find((l) => l.toId === stop.id);
  const from = legIn ? (legIn.fromId === "start" ? tour.start : tour.stops.find((s) => s.id === legIn.fromId)) : undefined;
  const next = tour.stops[index + 1];
  const legOut = next ? tour.legs.find((l) => l.toId === next.id) : undefined;
  const prev = tour.stops[index - 1];
  const secretsHere = (tour.curiosities ?? []).filter((c) => !c.onTheWay && c.nearStopId === stop.id);
  const secretsNext = (tour.curiosities ?? []).filter((c) => c.onTheWay && c.nearStopId === stop.id);
  const photos = [stop.photo, ...(d?.gallery ?? []).filter((p) => p.url !== stop.photo?.url)].filter(Boolean) as PhotoT[];
  const baseTrack = { subtitle: `Stop ${index + 1} · ${stop.name}`, artwork: stop.photo?.url, href: stopHref(tour.id, stop.id) };

  return (
    <main className="mx-auto min-h-dvh max-w-xl" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 110px)" }}>
      <Gallery photos={photos} alt={stop.name} category={stop.category} />
      <div className="pt-safe fixed left-0 top-0 z-[1050] px-3 pt-3">
        <Link
          href={tourHref(tour.id, "today")}
          aria-label="Back to tour"
          className="mt-2 flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
        >
          <ChevronLeft className="size-6" />
        </Link>
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs text-white">{index + 1}</span>
          {CATEGORY_LABEL[stop.category]}
          {stop.arriveAt && (
            <span className="font-normal text-muted">
              · {formatClock(stop.arriveAt)}–{formatClock(stop.departAt!)}
            </span>
          )}
        </div>
        <h1 className="mt-1 font-display text-[30px] font-bold leading-tight">{stop.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Clock className="size-4" /> {stop.openingNote}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={appleDirectionsUrl(stop, legIn?.mode ?? "walk", from ?? undefined)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white active:opacity-80"
          >
            <Navigation className="size-4" /> Directions
          </a>
          <button
            onClick={() =>
              void updateTour(tour.id, (t) => ({ ...t, stops: t.stops.map((s) => (s.id === stop.id ? { ...s, visited: !s.visited } : s)) }))
            }
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${stop.visited ? "bg-good/15 text-good" : "bg-chip"}`}
          >
            <Check className="size-4" /> {stop.visited ? "Visited" : "Mark visited"}
          </button>
          {stop.wikiUrl && (
            <a href={stop.wikiUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-chip px-4 py-2 text-sm font-semibold">
              <BookOpen className="size-4" /> Wikipedia
            </a>
          )}
        </div>
      </div>

      {!d ? (
        <div className="mx-4 mt-6 rounded-3xl bg-card p-6 text-center">
          {failed ? (
            <button onClick={() => void ensureStopDetails(tour.id, stop.id)} className="inline-flex items-center gap-2 font-semibold text-accent">
              <RefreshCw className="size-5" /> Couldn&apos;t load this guide — retry
            </button>
          ) : (
            <>
              <Loader2 className="mx-auto size-7 animate-spin text-accent" />
              <p className="mt-3 font-semibold">Your guide is writing this page…</p>
              <p className="mt-1 text-sm text-muted">{stop.summary}</p>
            </>
          )}
        </div>
      ) : (
        <>
          {audio && d.narration && (
            <EpisodeCard
              className="mx-4 mt-5"
              kicker={`Audio guide · stop ${index + 1}`}
              track={{ ...baseTrack, id: `${tour.id}:${stop.id}`, title: d.narration.title || stop.name, narration: d.narration }}
            />
          )}

          <section className="mt-6 space-y-3 px-5 text-[17px] leading-relaxed">
            {d.overview.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="rounded-2xl bg-accent-soft p-4 text-[15px]">
              <span className="font-semibold text-accent">Why it&apos;s on your tour: </span>
              {stop.whyForYou}
            </p>
          </section>

          <section className="mt-7 px-4">
            <h2 className="px-1 font-display text-[22px] font-bold">{isFood ? "What to try" : "Highlights"}</h2>
            <div className="mt-3 space-y-4">
              {d.features.map((f) => (
                <article key={f.id} className="overflow-hidden rounded-3xl bg-card shadow-sm">
                  {f.photo && (
                    <figure>
                      <Photo photo={f.photo} category={stop.category} alt={f.title} className="h-52 w-full" />
                      {f.photo.credit && <figcaption className="truncate px-4 pt-1 text-[10px] text-muted">{f.photo.credit}</figcaption>}
                    </figure>
                  )}
                  <div className="p-4">
                    <h3 className="font-display text-lg font-bold">{f.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed">{f.description}</p>
                    <p className="mt-2 flex gap-2 rounded-xl bg-card-2 p-3 text-sm">
                      <Eye className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span>
                        <b>{isFood ? "Try:" : "Look for:"}</b> {f.lookFor}
                      </span>
                    </p>
                    {audio && f.narration && (
                      <div className="mt-3">
                        <PlayChip track={{ ...baseTrack, id: `${tour.id}:${f.id}`, title: f.title, narration: f.narration, priority: "extra" }} />
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {secretsHere.length + secretsNext.length > 0 && (
            <section className="mx-4 mt-7 space-y-4">
              <h2 className="px-1 font-display text-[22px] font-bold">Off the tourist script</h2>
              <CuriosityGroup title="Right here" items={secretsHere} />
              <CuriosityGroup title={next ? `On the way to ${next.name}` : "On your way out"} items={secretsNext} />
            </section>
          )}

          <section className="mx-4 mt-6 space-y-3 rounded-3xl bg-card p-5 text-[15px]">
            <h2 className="font-semibold">Good to know today</h2>
            <Info icon={<Clock className="size-4" />} label="Hours" value={d.practical.hours} />
            <Info icon={<Ticket className="size-4" />} label="Tickets" value={d.practical.tickets} />
            <Info icon={<Lightbulb className="size-4" />} label="Tip" value={d.practical.tip} />
          </section>

          <section className="mx-4 mt-4 flex gap-3 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 p-5 text-[15px] text-amber-950 dark:from-amber-900/40 dark:to-orange-900/30 dark:text-amber-100">
            <Sparkles className="mt-0.5 size-5 shrink-0" />
            <p>
              <b>Fun fact: </b>
              {d.funFact}
            </p>
          </section>
        </>
      )}

      <nav className="mx-4 mt-6 grid grid-cols-2 gap-3">
        {prev ? (
          <Link href={stopHref(tour.id, prev.id)} className="rounded-2xl bg-card p-3 active:opacity-80">
            <div className="flex items-center text-xs text-muted">
              <ChevronLeft className="size-4" /> Previous
            </div>
            <div className="truncate font-semibold">{prev.name}</div>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={stopHref(tour.id, next.id)} className="rounded-2xl bg-card p-3 text-right active:opacity-80">
            <div className="flex items-center justify-end text-xs text-muted">
              Next{legOut ? ` · ${formatDuration(legOut.durationMin)} ${legOut.mode === "walk" ? "walk" : MODE_LABEL[legOut.mode].toLowerCase()} · ${formatDistance(legOut.distanceM)}` : ""}
              <ChevronRight className="size-4" />
            </div>
            <div className="truncate font-semibold">{next.name}</div>
          </Link>
        )}
      </nav>
    </main>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-accent">{icon}</span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}

function Gallery({ photos, alt, category }: { photos: PhotoT[]; alt: string; category: Parameters<typeof Photo>[0]["category"] }) {
  const [page, setPage] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  if (photos.length === 0) return <Photo category={category} alt={alt} className="h-80 w-full" iconClass="size-16" />;
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="scrollbar-none flex h-80 snap-x snap-mandatory overflow-x-auto"
      >
        {photos.map((p, i) => (
          <div key={p.url + i} className="relative h-full w-full shrink-0 snap-center">
            <Photo photo={p} category={category} alt={p.caption ?? alt} className="h-full w-full" />
            {p.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-6 pt-8 text-xs text-white/90">
                <span className="line-clamp-2">{p.caption}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <span key={i} className={`size-1.5 rounded-full ${i === page ? "bg-white" : "bg-white/45"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
