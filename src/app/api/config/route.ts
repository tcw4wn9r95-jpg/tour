import { rejectWithoutPasscode } from "@/lib/server/auth";
import { hasClaude, MODEL } from "@/lib/server/claude";
import { ttsProvider } from "@/lib/server/tts";
import type { AppConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const claude = hasClaude();
  const config: AppConfig & { passcodeOk: boolean } = {
    claude,
    demo: !claude,
    tts: ttsProvider(),
    restaurants: process.env.GOOGLE_PLACES_API_KEY ? "google" : claude ? "web" : "demo",
    passcodeRequired: Boolean(process.env.APP_PASSCODE),
    passcodeOk: rejectWithoutPasscode(req) === null,
    model: MODEL,
  };
  return Response.json(config, { headers: { "cache-control": "no-store" } });
}
