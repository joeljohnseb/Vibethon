import { NextResponse } from "next/server";
import { CITY_PRESETS } from "@/lib/constants";
import { rateLimit } from "@/lib/ratelimit";

/** Location search: city presets first, then OpenStreetMap Nominatim (India only). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const presets = CITY_PRESETS.filter((c) => c.name.toLowerCase().startsWith(q.toLowerCase())).map((c) => ({ label: c.name, lat: c.lat, lng: c.lng }));
  try {
    rateLimit(`geocode:${req.headers.get("x-forwarded-for") ?? "local"}`, 30, 60_000);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ q, format: "jsonv2", countrycodes: "in", limit: "6", addressdetails: "0" }).toString();
    const res = await fetch(url, { headers: { "User-Agent": "Eber/0.1 (EV charging marketplace)", "Accept-Language": "en" }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    const results = data.map((d) => ({ label: d.display_name.split(",").slice(0, 3).join(","), lat: Number(d.lat), lng: Number(d.lon) }));
    return NextResponse.json({ results: [...presets, ...results].slice(0, 8) });
  } catch {
    return NextResponse.json({ results: presets, degraded: true });
  }
}
