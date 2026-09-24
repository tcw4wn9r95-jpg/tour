"use client";
import { Headphones, Loader2, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { getPlayer, usePlayer, type Track } from "@/lib/audio/player";
import { INTRO_S, OUTRO_S } from "@/lib/audio/mixer";

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/** Rough spoken length (~150 wpm) plus the music intro/outro. */
export function estimateSeconds(script: string): number {
  return (script.split(/\s+/).length / 150) * 60 + INTRO_S + OUTRO_S;
}

function Equalizer() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]">
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className="eq-bar block h-full w-[3px] rounded-full bg-current" style={{ animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

/** Small round play button with a label, used for stop features. */
export function PlayChip({ track, label }: { track: Track; label?: string }) {
  const state = usePlayer();
  const current = state.track?.id === track.id;
  const status = current ? state.status : "idle";
  return (
    <button
      onClick={() => getPlayer().toggle(track)}
      className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1.5 pl-1.5 pr-3 text-sm font-semibold text-accent active:opacity-70"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-accent text-white">
        {status === "loading" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : status === "playing" ? (
          <Pause className="size-3.5 fill-current" />
        ) : (
          <Play className="ml-0.5 size-3.5 fill-current" />
        )}
      </span>
      {status === "playing" ? <Equalizer /> : null}
      <span>{label ?? `Listen · ${fmt(estimateSeconds(track.narration.script))}`}</span>
    </button>
  );
}

/** Big "podcast episode" card with progress bar and skip controls. */
export function EpisodeCard({ track, kicker, className = "" }: { track: Track; kicker: string; className?: string }) {
  const state = usePlayer();
  const current = state.track?.id === track.id;
  const status = current ? state.status : "idle";
  const duration = current && state.duration ? state.duration : estimateSeconds(track.narration.script);
  const position = current ? state.position : 0;
  const pct = Math.min(100, (position / duration) * 100 || 0);
  const player = getPlayer();

  return (
    <div className={`overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b1b4a] via-[#4a2150] to-[#a8452f] p-4 text-white shadow-lg ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/70">
        <Headphones className="size-3.5" /> {kicker}
      </div>
      <div className="mt-1.5 font-display text-lg font-bold leading-snug">{track.narration.title || track.title}</div>
      <div className="mt-0.5 text-sm text-white/70">
        {status === "loading" ? "Recording your guide…" : state.error && current ? state.error : `${track.subtitle} · ${fmt(duration)}`}
      </div>
      <div
        className="mt-4 h-1.5 cursor-pointer rounded-full bg-white/20"
        onClick={(e) => {
          if (!current) return;
          const r = e.currentTarget.getBoundingClientRect();
          player.seek((e.clientX - r.left) / r.width);
        }}
      >
        <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/60">
        <span>{fmt(position)}</span>
        <span>-{fmt(duration - position)}</span>
      </div>
      <div className="mt-1 flex items-center justify-center gap-8">
        <button aria-label="Back 10 seconds" onClick={() => player.skip(-10)} disabled={!current || state.mode !== "audio"} className="text-white/80 disabled:opacity-30">
          <RotateCcw className="size-6" />
        </button>
        <button
          aria-label={status === "playing" ? "Pause" : "Play"}
          onClick={() => player.toggle(track)}
          className="flex size-14 items-center justify-center rounded-full bg-white text-[#4a2150] shadow-md active:scale-95"
        >
          {status === "loading" ? (
            <Loader2 className="size-6 animate-spin" />
          ) : status === "playing" ? (
            <Pause className="size-6 fill-current" />
          ) : (
            <Play className="ml-1 size-6 fill-current" />
          )}
        </button>
        <button aria-label="Forward 10 seconds" onClick={() => player.skip(10)} disabled={!current || state.mode !== "audio"} className="text-white/80 disabled:opacity-30">
          <RotateCw className="size-6" />
        </button>
      </div>
    </div>
  );
}
