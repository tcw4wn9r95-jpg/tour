import { voiceUsage } from "@/lib/guide/service";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { serverEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  return Response.json(await voiceUsage(serverEnv()), { headers: { "cache-control": "no-store" } });
}
