// Shared data model for tour packages. Everything here is plain JSON so a
// tour can be stored in IndexedDB and sent to the API routes as-is.

export type LatLng = { lat: number; lng: number };

export type Focus = "food" | "architecture" | "history" | "everything";
export type LongLegMode = "transit" | "car";
export type LegMode = "walk" | LongLegMode;
export type Mood = "warm" | "majestic" | "lively" | "mellow" | "mysterious" | "romantic";
export type StopCategory =
  | "food"
  | "architecture"
  | "history"
  | "museum"
  | "culture"
  | "nature"
  | "viewpoint"
  | "market"
  | "neighborhood"
  | "religious";
export type MealKind = "breakfast" | "lunch" | "coffee" | "dinner";

/** The device's clock at the moment the tour was requested. */
export interface LocalMoment {
  iso: string; // full ISO timestamp with offset
  weekday: string; // "Thursday"
  date: string; // "September 24, 2026"
  time: string; // "10:24 AM"
  timeZone: string; // "Europe/Lisbon"
  utcOffsetMinutes: number;
}

/** What the chat collects before asking Claude for a plan. */
export interface TourRequest {
  city: string;
  focus: Focus[];
  focusNotes?: string;
  timeAvailable: string;
  transport: LongLegMode;
  constraints: string;
  now: LocalMoment;
  userLocation?: LatLng;
}

export interface Narration {
  title: string;
  script: string;
  mood: Mood;
}

export interface Photo {
  url: string;
  thumb?: string;
  caption?: string;
  credit?: string;
  sourceUrl?: string;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  lookFor: string;
  imageSearch: string;
  /** Only on landmarks. */
  narration?: Narration;
  photo?: Photo;
}

export interface StopDetails {
  overview: string[];
  /** Only on landmarks. */
  narration?: Narration;
  features: Feature[];
  practical: { hours: string; tickets: string; tip: string };
  funFact: string;
  gallery: Photo[];
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: StopCategory;
  /** A major landmark gets audio; food and minor stops don't. Missing on older tours. */
  landmark?: boolean;
  wikipediaTitle: string | null;
  summary: string;
  whyForYou: string;
  durationMin: number;
  openingNote: string;
  anchor: "first" | "last" | "none";
  photo?: Photo;
  wikiUrl?: string;
  /** Filled by the schedule. */
  arriveAt?: string;
  departAt?: string;
  details?: StopDetails;
  visited?: boolean;
}

export interface Leg {
  fromId: string; // "start" or a stop id
  toId: string;
  mode: LegMode;
  distanceM: number;
  durationMin: number;
  /** [lat, lng] pairs; missing for public transport (drawn as a straight dashed line). */
  path?: [number, number][];
  departAt?: string;
}

export interface MealSlot {
  id: string;
  kind: MealKind;
  at: string; // ISO time the break starts
  durationMin: number;
  afterStopId: string | null; // null = before the first stop
  near: LatLng;
  nearName: string;
}

export interface Restaurant {
  name: string;
  cuisine: string;
  rating: number | null;
  reviewCount: number | null;
  ratingSource: string;
  priceLevel: string;
  address: string;
  lat: number | null;
  lng: number | null;
  distanceM: number | null;
  why: string;
  mapsUrl: string;
  photoUrl?: string;
  openNow?: boolean | null;
}

export interface MealRecommendation {
  slotId: string;
  kind: MealKind;
  restaurants: Restaurant[];
  source: "google" | "web" | "claude";
  note?: string;
}

export interface TourIntro {
  headline: string;
  welcome: string[];
  themes: string[];
  whatToExpect: string[];
}

export interface Tour {
  id: string;
  createdAt: string;
  request: TourRequest;
  title: string;
  subtitle: string;
  city: string;
  region: string;
  country: string;
  center: LatLng;
  intro: TourIntro;
  tips: string[];
  longLegMode: LongLegMode;
  start?: LatLng & { label: string };
  startAt: string;
  endAt: string;
  stops: Stop[];
  legs: Leg[];
  meals: MealSlot[];
  totalDistanceM: number;
  coverPhoto?: Photo;
  todayIntro?: Narration;
  restaurants?: MealRecommendation[];
  demo?: boolean;
}

/** Plan exactly as Claude returns it, before geocoding, ordering and scheduling. */
export interface RawPlan {
  title: string;
  subtitle: string;
  city: string;
  region: string;
  country: string;
  center: LatLng;
  startTime: string | null;
  longLegMode: LongLegMode;
  intro: TourIntro;
  tips: string[];
  stops: Array<Omit<Stop, "id" | "photo" | "wikiUrl" | "arriveAt" | "departAt" | "details" | "visited">>;
}

export interface AppConfig {
  claude: boolean;
  demo: boolean;
  tts: "elevenlabs" | "openai" | "browser";
  restaurants: "google" | "web" | "demo";
  passcodeRequired: boolean;
  /** GitHub Pages build: API keys are entered in Settings and kept on this device. */
  keysOnDevice: boolean;
  model: string;
}
