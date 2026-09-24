import type { Focus, MealKind, Stop, StopCategory } from "./types";

export const FOCUS_LABEL: Record<Focus, string> = {
  food: "Food",
  architecture: "Architecture",
  history: "History",
  everything: "A bit of everything",
};

export const FOCUS_EMOJI: Record<Focus, string> = {
  food: "🍽️",
  architecture: "🏛️",
  history: "📜",
  everything: "✨",
};

export const MEAL_LABEL: Record<MealKind, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  coffee: "Coffee break",
  dinner: "Dinner",
};

export const MEAL_EMOJI: Record<MealKind, string> = {
  breakfast: "🥐",
  lunch: "🍽️",
  coffee: "☕️",
  dinner: "🍷",
};

export const CATEGORY_LABEL: Record<StopCategory, string> = {
  food: "Food",
  architecture: "Architecture",
  history: "History",
  museum: "Museum",
  culture: "Culture",
  nature: "Nature",
  viewpoint: "Viewpoint",
  market: "Market",
  neighborhood: "Neighborhood",
  religious: "Sacred site",
};

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const NO_AUDIO: StopCategory[] = ["food", "market"];

/** Audio stories are recorded for major landmarks only, never for food stops. */
export function hasAudioGuide(stop: Pick<Stop, "category" | "landmark">): boolean {
  return !NO_AUDIO.includes(stop.category) && stop.landmark !== false;
}
