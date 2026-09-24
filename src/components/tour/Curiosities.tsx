"use client";
import { ExternalLink, Eye, MapPin, Sparkles } from "lucide-react";
import type { Curiosity, CuriosityKind } from "@/lib/types";

const KIND_LABEL: Record<CuriosityKind, string> = {
  quirk: "Local quirk",
  legend: "Legend",
  "hidden-detail": "Hidden detail",
  "local-habit": "Local habit",
  "street-art": "Street art",
  viewpoint: "Secret viewpoint",
};

export function CuriosityCard({ c }: { c: Curiosity }) {
  return (
    <article className="rounded-2xl border border-amber-300/70 bg-amber-50 p-3.5 dark:border-amber-500/30 dark:bg-amber-950/30">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
        <Sparkles className="size-3.5" /> {KIND_LABEL[c.kind]} · off the tourist script
      </div>
      <h4 className="mt-1 font-semibold">{c.title}</h4>
      <p className="mt-1 text-[15px] leading-snug">{c.story}</p>
      <p className="mt-2 flex gap-2 text-sm">
        <Eye className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <span>
          <b>Look for:</b> {c.lookFor}
        </span>
      </p>
      <p className="mt-1 flex gap-2 text-xs text-muted">
        <MapPin className="mt-px size-3.5 shrink-0" /> {c.where}
      </p>
      <div className="mt-2 text-xs text-muted">
        {c.sourceUrl ? (
          <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
            via {c.sourceName} <ExternalLink className="size-3" />
          </a>
        ) : (
          <span>via {c.sourceName}</span>
        )}
      </div>
    </article>
  );
}

/** A labelled group of curiosities, e.g. "On the way to the cathedral". */
export function CuriosityGroup({ title, items }: { title: string; items: Curiosity[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        <Sparkles className="size-3.5 text-amber-500" /> {title}
      </div>
      {items.map((c) => (
        <CuriosityCard key={c.id} c={c} />
      ))}
    </div>
  );
}
