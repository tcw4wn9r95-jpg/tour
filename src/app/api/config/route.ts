import { appConfig } from "@/lib/guide/service";
import { rejectWithoutPasscode } from "@/lib/server/auth";
import { serverEnv } from "@/lib/server/env";
import type { AppConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const config: AppConfig & { passcodeOk: boolean } = {
    ...appConfig(serverEnv()),
    passcodeRequired: Boolean(process.env.APP_PASSCODE),
    passcodeOk: rejectWithoutPasscode(req) === null,
    keysOnDevice: false,
  };
  return Response.json(config, { headers: { "cache-control": "no-store" } });
}
