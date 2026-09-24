import type { LocalMoment } from "./types";

export function localMoment(d = new Date()): LocalMoment {
  return {
    iso: d.toISOString(),
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    date: d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcOffsetMinutes: -d.getTimezoneOffset(),
  };
}

/** Quick replies for "how much time do you have?" that make sense for the current hour. */
export function timeSuggestions(d = new Date()): string[] {
  const h = d.getHours();
  if (h < 11) return ["Full day", "Half day (about 4 hours)", "2–3 hours", "Until lunch"];
  if (h < 15) return ["The rest of the day", "About 3 hours", "2 hours", "Until dinner"];
  if (h < 19) return ["Until sunset", "About 2 hours", "Through dinner", "Just an hour"];
  return ["A couple of hours tonight", "About 1 hour", "Until late"];
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
