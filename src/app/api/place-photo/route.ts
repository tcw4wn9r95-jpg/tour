import { rejectWithoutPasscode } from "@/lib/server/auth";

export const runtime = "nodejs";

/** Proxies Google Places photos so the API key never reaches the phone. */
export async function GET(req: Request) {
  const denied = rejectWithoutPasscode(req);
  if (denied) return denied;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!key || !/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) return new Response("Not found", { status: 404 });

  const res = await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&skipHttpRedirect=true&key=${encodeURIComponent(key)}`,
  );
  if (!res.ok) return new Response("Photo unavailable", { status: 502 });
  const { photoUri } = (await res.json()) as { photoUri?: string };
  if (!photoUri) return new Response("Photo unavailable", { status: 502 });
  return Response.redirect(photoUri, 302);
}
