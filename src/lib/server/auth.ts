import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * When APP_PASSCODE is set, every API call must carry it (header, or `k`
 * query param for <img> URLs) so a deployed app can't spend your credits.
 */
export function rejectWithoutPasscode(req: Request): Response | null {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return null;
  const given = req.headers.get("x-app-passcode") ?? new URL(req.url).searchParams.get("k") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length === b.length && timingSafeEqual(a, b)) return null;
  return Response.json({ error: "Enter the app passcode to continue.", code: "passcode" }, { status: 401 });
}
