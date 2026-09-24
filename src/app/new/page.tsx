"use client";
import { ArrowUp, Check, ChevronLeft, Compass, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, requestPlan } from "@/lib/client/api";
import { buildTour, ensureTourContent, reverseGeocode } from "@/lib/client/enrich";
import { FOCUS_EMOJI, FOCUS_LABEL } from "@/lib/labels";
import { greeting, localMoment, timeSuggestions } from "@/lib/time";
import type { Focus, LatLng, LongLegMode, TourRequest } from "@/lib/types";

type Step = "city" | "focus" | "time" | "transport" | "constraints" | "confirm" | "building" | "error";

interface Msg {
  id: number;
  from: "guide" | "me";
  text: string;
  list?: string[];
}

const FOCUS_OPTIONS: Focus[] = ["food", "architecture", "history", "everything"];
const CONSTRAINT_OPTIONS = ["Vegetarian", "Kid-friendly", "Limited mobility", "On a budget", "Avoid crowds", "Skip museums"];

let nextId = 1;

export default function NewTour() {
  const router = useRouter();
  const moment = useMemo(() => localMoment(), []);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("city");
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus[]>([]);
  const [constraintPicks, setConstraintPicks] = useState<string[]>([]);
  const answers = useRef<Partial<TourRequest>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const say = (text: string, extra: Partial<Msg> = {}) => {
    const id = nextId++;
    setMessages((m) => [...m, { id, from: "guide", text, ...extra }]);
    return id;
  };
  const me = (text: string) => setMessages((m) => [...m, { id: nextId++, from: "me", text }]);

  /** Guide "types" for a moment before speaking, like a real chat. */
  const guideSays = async (...texts: string[]) => {
    for (const t of texts) {
      setTyping(true);
      await new Promise((r) => setTimeout(r, Math.min(900, 300 + t.length * 8)));
      setTyping(false);
      say(t);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void guideSays(
      `${greeting()}! I'm your guide for today. 👋`,
      `It's ${moment.weekday}, ${moment.time}. Which city or area are we exploring?`,
    );
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(p);
        const city = await reverseGeocode(p).catch(() => null);
        if (city) setDetectedCity(city);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, step]);

  const answer = async (text: string) => {
    const value = text.trim();
    if (!value || typing) return;
    setInput("");
    switch (step) {
      case "city":
        me(value);
        answers.current.city = value;
        setStep("focus");
        await guideSays(`${value.split(",")[0]} — wonderful choice. What should today focus on? Pick one or more.`);
        break;
      case "focus": {
        const picked = focus.length ? focus : (["everything"] as Focus[]);
        const typed = FOCUS_OPTIONS.includes(value as Focus) ? "" : value;
        me(focus.length ? `${picked.map((f) => FOCUS_LABEL[f]).join(" + ")}${typed ? ` — ${typed}` : ""}` : value);
        answers.current.focus = picked;
        answers.current.focusNotes = typed || undefined;
        setStep("time");
        await guideSays(`Got it. It's ${moment.time} now — how much time do you have today?`);
        break;
      }
      case "time":
        me(value);
        answers.current.timeAvailable = value;
        setStep("transport");
        await guideSays("I'll walk you between anything under 1 km. For longer hops, how do you like to get around?");
        break;
      case "transport": {
        const mode: LongLegMode = /car|taxi|uber|drive|ride/i.test(value) ? "car" : "transit";
        me(value);
        answers.current.transport = mode;
        setStep("constraints");
        await guideSays("Last one: any constraints or special requests? Diet, mobility, kids, budget, things you've already seen…");
        break;
      }
      case "constraints": {
        const typed = value === constraintPicks.join(", ") || /^(no|none|nope|nothing)\b/i.test(value) ? "" : value;
        const all = [...constraintPicks, typed].filter(Boolean);
        me(value);
        answers.current.constraints = all.join("; ");
        setStep("confirm");
        await guideSays("Perfect, here's what I've got:");
        break;
      }
    }
  };

  const build = async () => {
    const a = answers.current;
    const request: TourRequest = {
      city: a.city!,
      focus: a.focus ?? ["everything"],
      focusNotes: a.focusNotes,
      timeAvailable: a.timeAvailable!,
      transport: a.transport ?? "transit",
      constraints: a.constraints ?? "",
      now: localMoment(),
      userLocation: location ?? undefined,
    };
    me("✨ Build my tour");
    setStep("building");
    setTyping(true);
    let listId: number | null = null;
    try {
      const { plan, demo } = await requestPlan(request, (e) => {
        if (e.type === "status") say(e.message);
        if (e.type === "stop") {
          listId ??= say("Picking your stops:", { list: [] });
          setMessages((m) => m.map((x) => (x.id === listId ? { ...x, list: [...(x.list ?? []), e.name] } : x)));
        }
      });
      const tour = await buildTour(plan, request, demo, (msg) => say(msg));
      setTyping(false);
      say("Your tour is ready! Opening it now… 🎒");
      void ensureTourContent(tour.id);
      setTimeout(() => router.replace(`/tour/${tour.id}`), 600);
    } catch (err) {
      setTyping(false);
      const msg = err instanceof ApiError ? err.message : "I lost the connection while planning.";
      say(`Sorry — ${msg}`);
      setStep("error");
    }
  };

  const restart = () => {
    answers.current = {};
    setFocus([]);
    setConstraintPicks([]);
    setMessages([]);
    setStep("city");
    started.current = false;
    void guideSays(`Let's start again. Which city or area are we exploring?`);
  };

  const a = answers.current;
  const quick: React.ReactNode = (() => {
    if (typing) return null;
    switch (step) {
      case "city":
        return detectedCity ? (
          <Chip onClick={() => answer(detectedCity)}>
            <MapPin className="size-4" /> {detectedCity}
          </Chip>
        ) : null;
      case "focus":
        return (
          <>
            {FOCUS_OPTIONS.map((f) => (
              <Chip
                key={f}
                active={focus.includes(f)}
                onClick={() =>
                  setFocus((cur) =>
                    f === "everything" ? ["everything"] : cur.includes(f) ? cur.filter((x) => x !== f) : [...cur.filter((x) => x !== "everything"), f],
                  )
                }
              >
                {FOCUS_EMOJI[f]} {FOCUS_LABEL[f]}
              </Chip>
            ))}
            {focus.length > 0 && (
              <Chip primary onClick={() => answer(input || focus[0])}>
                <Check className="size-4" /> Done
              </Chip>
            )}
          </>
        );
      case "time":
        return timeSuggestions().map((t) => (
          <Chip key={t} onClick={() => answer(t)}>
            {t}
          </Chip>
        ));
      case "transport":
        return (
          <>
            <Chip onClick={() => answer("🚇 Public transport")}>🚇 Public transport</Chip>
            <Chip onClick={() => answer("🚕 Car / taxi")}>🚕 Car / taxi</Chip>
          </>
        );
      case "constraints":
        return (
          <>
            {constraintPicks.length === 0 && <Chip onClick={() => answer("No constraints — surprise me!")}>No, surprise me!</Chip>}
            {CONSTRAINT_OPTIONS.map((c) => (
              <Chip key={c} active={constraintPicks.includes(c)} onClick={() => setConstraintPicks((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}>
                {c}
              </Chip>
            ))}
            {constraintPicks.length > 0 && (
              <Chip primary onClick={() => answer(input || constraintPicks.join(", "))}>
                <Check className="size-4" /> Done
              </Chip>
            )}
          </>
        );
      case "error":
        return (
          <>
            <Chip primary onClick={build}>
              Try again
            </Chip>
            <Chip onClick={restart}>Start over</Chip>
          </>
        );
      default:
        return null;
    }
  })();

  const placeholder: Partial<Record<Step, string>> = {
    city: "e.g. Lisbon, or Kyoto's Gion district",
    focus: "Or describe it: street art, coffee, royals…",
    time: 'e.g. "until 5 pm" or "3 hours"',
    transport: "Public transport or car",
    constraints: "Anything I should know?",
  };
  const showInput = ["city", "focus", "time", "transport", "constraints"].includes(step) && !typing;

  return (
    <main className="mx-auto flex h-dvh max-w-xl flex-col">
      <header className="pt-safe border-b border-line bg-bg/90 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Link href="/" className="flex items-center text-accent" aria-label="Back">
            <ChevronLeft className="size-7" />
          </Link>
          <GuideAvatar />
          <div>
            <div className="text-[15px] font-semibold leading-tight">Your tour guide</div>
            <div className="text-xs text-muted">{typing ? "typing…" : "Powered by Claude"}</div>
          </div>
        </div>
      </header>

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}
        {step === "confirm" && !typing && (
          <div className="fade-up ml-10 max-w-[85%] rounded-2xl border border-line bg-card p-4 text-[15px]">
            <SummaryRow label="City" value={a.city} />
            <SummaryRow label="Focus" value={(a.focus ?? []).map((f) => FOCUS_LABEL[f]).join(", ") + (a.focusNotes ? ` — ${a.focusNotes}` : "")} />
            <SummaryRow label="Time" value={`${a.timeAvailable} (from ${moment.time}, ${moment.weekday})`} />
            <SummaryRow label="Getting around" value={a.transport === "car" ? "Walk + car/taxi" : "Walk + public transport"} />
            <SummaryRow label="Requests" value={a.constraints || "None"} />
            <div className="mt-3 flex gap-2">
              <button onClick={build} className="flex-1 rounded-xl bg-accent py-2.5 font-semibold text-white active:opacity-80">
                ✨ Build my tour
              </button>
              <button onClick={restart} className="rounded-xl bg-chip px-4 py-2.5 font-medium active:opacity-80">
                Edit
              </button>
            </div>
          </div>
        )}
        {typing && (
          <div className="flex items-end gap-2">
            <GuideAvatar small />
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-bubble px-4 py-3">
              {[0, 0.15, 0.3].map((d) => (
                <span key={d} className="typing-dot size-2 rounded-full bg-muted" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pb-safe border-t border-line bg-bg/95 backdrop-blur-xl">
        {quick && <div className="scrollbar-none flex gap-2 overflow-x-auto px-3 pt-3">{quick}</div>}
        {showInput && (
          <form
            className="flex items-center gap-2 px-3 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === "focus" && !input.trim() && focus.length) return void answer(focus[0]);
              void answer(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder[step]}
              enterKeyHint="send"
              className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2.5 outline-none focus:border-accent"
            />
            <button
              aria-label="Send"
              disabled={!input.trim() && !(step === "focus" && focus.length)}
              className="flex size-10 items-center justify-center rounded-full bg-accent text-white disabled:opacity-30"
            >
              <ArrowUp className="size-5" strokeWidth={2.6} />
            </button>
          </form>
        )}
        {!showInput && !quick && <div className="h-3" />}
      </div>
    </main>
  );
}

function GuideAvatar({ small }: { small?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4a2150] to-[#f0532d] text-white ${small ? "size-8" : "size-9"}`}>
      <Compass className={small ? "size-4" : "size-5"} />
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.from === "me") {
    return (
      <div className="fade-up flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[16px] text-white">{msg.text}</div>
      </div>
    );
  }
  return (
    <div className="fade-up flex items-end gap-2">
      <GuideAvatar small />
      <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-bubble px-4 py-2.5 text-[16px]">
        {msg.text}
        {msg.list && msg.list.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {msg.list.map((s, i) => (
              <li key={s} className="fade-up flex items-center gap-2 text-[15px]">
                <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Chip({ children, onClick, active, primary }: { children: React.ReactNode; onClick: () => void; active?: boolean; primary?: boolean }) {
  const cls = primary
    ? "bg-accent text-white border-accent"
    : active
      ? "bg-accent-soft text-accent border-accent"
      : "bg-card text-fg border-line";
  return (
    <button onClick={onClick} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[15px] font-medium active:scale-95 ${cls}`}>
      {children}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-3 py-1">
      <span className="w-28 shrink-0 text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
