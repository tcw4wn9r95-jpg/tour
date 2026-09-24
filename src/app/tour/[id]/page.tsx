"use client";
import { CalendarDays, ChevronLeft, Compass, Download, Loader2, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Overview } from "@/components/tour/Overview";
import { Today } from "@/components/tour/Today";
import { prefetchVoices } from "@/lib/audio/player";
import { ensureRestaurants, ensureTourContent, useTourTasks } from "@/lib/client/enrich";
import { deleteTour, useTour } from "@/lib/client/store";
import type { Tour } from "@/lib/types";

type Tab = "overview" | "today";

export default function TourPage() {
  const { id } = useParams<{ id: string }>();
  const tour = useTour(id);
  const router = useRouter();
  const tasks = useTourTasks(id);
  const [tab, setTab] = useState<Tab>("overview");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash === "#today") setTab("today");
  }, []);

  // Resume any background work (stop guides, welcome audio, restaurants).
  useEffect(() => {
    if (id) void ensureTourContent(id);
  }, [id]);

  const switchTab = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "today" ? "#today" : "#");
    window.scrollTo({ top: 0 });
  };

  if (tour === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted" />
      </div>
    );
  }
  if (tour === null) {
    return (
      <div className="pt-safe flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-lg font-semibold">This tour isn&apos;t on this device.</p>
        <Link href="/" className="font-semibold text-accent">
          Back to my tours
        </Link>
      </div>
    );
  }

  const downloadAudio = async () => {
    setMenu(false);
    const scripts = collectScripts(tour);
    try {
      setToast("Downloading audio…");
      await prefetchVoices(scripts, (done, total) => setToast(`Downloading audio ${done}/${total}…`));
      setToast("Audio saved for offline use ✓");
    } catch {
      setToast("Some audio couldn't be downloaded. Try again with a better connection.");
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-xl" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 140px)" }}>
      <header className="pt-safe sticky top-0 z-[1050] border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="flex items-center gap-1 px-2 py-2">
          <Link href="/" className="flex items-center font-medium text-accent">
            <ChevronLeft className="size-7" /> Tours
          </Link>
          <div className="min-w-0 flex-1 truncate text-center font-semibold">{tour.city}</div>
          {tasks.running > 0 ? (
            <span className="flex items-center gap-1 px-1 text-xs text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Preparing
            </span>
          ) : null}
          <button aria-label="More" onClick={() => setMenu((m) => !m)} className="p-2 text-accent">
            <MoreHorizontal className="size-6" />
          </button>
        </div>
        {menu && (
          <div className="absolute right-3 top-full mt-1 w-64 overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
            <MenuItem icon={<Download className="size-4" />} onClick={downloadAudio}>
              Download audio for offline
            </MenuItem>
            <MenuItem
              icon={<RefreshCw className="size-4" />}
              onClick={() => {
                setMenu(false);
                void ensureRestaurants(tour.id, true);
              }}
            >
              Refresh restaurant picks
            </MenuItem>
            <MenuItem
              danger
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!confirm(`Delete "${tour.title}"?`)) return;
                await deleteTour(tour.id);
                router.replace("/");
              }}
            >
              Delete tour
            </MenuItem>
          </div>
        )}
      </header>

      {tour.demo && (
        <div className="mx-4 mt-3 rounded-xl bg-accent-soft px-3 py-2 text-center text-xs text-accent">
          Sample tour (demo mode) — add your Anthropic API key to plan real ones.
        </div>
      )}

      {tab === "overview" ? <Overview tour={tour} onStart={() => switchTab("today")} /> : <Today tour={tour} />}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-[1050] border-t border-line bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl">
          <TabButton active={tab === "overview"} onClick={() => switchTab("overview")} icon={<Compass className="size-6" />}>
            Overview
          </TabButton>
          <TabButton active={tab === "today"} onClick={() => switchTab("today")} icon={<CalendarDays className="size-6" />}>
            Today&apos;s tour
          </TabButton>
        </div>
      </nav>

      {toast && (
        <div className="fixed inset-x-0 top-24 z-[1300] flex justify-center px-6">
          <div className="rounded-full bg-black/80 px-4 py-2 text-sm text-white">{toast}</div>
        </div>
      )}
    </main>
  );
}

function collectScripts(tour: Tour): string[] {
  const out: string[] = [];
  if (tour.todayIntro) out.push(tour.todayIntro.script);
  for (const s of tour.stops) {
    if (!s.details) continue;
    out.push(s.details.narration.script, ...s.details.features.map((f) => f.narration.script));
  }
  return out;
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}>
      {icon}
      {children}
    </button>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left text-[15px] last:border-0 active:bg-card-2 ${danger ? "text-red-500" : ""}`}>
      {icon}
      {children}
    </button>
  );
}
