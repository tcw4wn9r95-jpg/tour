"use client";
import { Loader2, Pause, Play, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPlayer, usePlayer } from "@/lib/audio/player";

/** Floating "now playing" bar so narration keeps going while you browse. */
export function MiniPlayer() {
  const state = usePlayer();
  const pathname = usePathname();
  if (!state.track || state.status === "idle") return null;
  const player = getPlayer();
  const pct = state.duration ? Math.min(100, (state.position / state.duration) * 100) : 0;
  const onTourPage = pathname?.replace(/\/$/, "") === "/tour";
  const bottom = onTourPage ? "calc(env(safe-area-inset-bottom) + 64px)" : "calc(env(safe-area-inset-bottom) + 12px)";

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[1100] flex justify-center px-3" style={{ bottom }}>
      <div className="pointer-events-auto relative flex w-full max-w-xl items-center gap-3 overflow-hidden rounded-2xl border border-line bg-card/95 p-2 pr-3 shadow-xl backdrop-blur-xl">
        {state.track.artwork ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.track.artwork} alt="" className="size-11 rounded-xl object-cover" />
        ) : (
          <div className="size-11 rounded-xl bg-gradient-to-br from-[#4a2150] to-[#a8452f]" />
        )}
        <Link href={state.track.href ?? "#"} className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{state.track.title}</div>
          <div className="truncate text-xs text-muted">
            {state.status === "loading" ? "Recording your guide…" : state.status === "error" ? state.error : state.track.subtitle}
          </div>
        </Link>
        <button aria-label="Play or pause" onClick={() => player.toggle(state.track!)} className="flex size-10 items-center justify-center rounded-full bg-accent text-white">
          {state.status === "loading" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : state.status === "playing" ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="ml-0.5 size-5 fill-current" />
          )}
        </button>
        <button aria-label="Close player" onClick={() => player.stop()} className="text-muted">
          <X className="size-5" />
        </button>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
