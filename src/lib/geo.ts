import { createHash } from "node:crypto";

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/**
 * Public, approximate position for a listing: a stable offset of 250–550 m in a
 * direction derived from a keyed hash of the id, rounded to ~100 m. The exact
 * location is only shown to the homeowner and to a taker with a confirmed booking.
 */
export function approximateLocation(id: string, lat: number, lng: number, salt: string) {
  const h = createHash("sha256").update(`${salt}:${id}`).digest();
  const angle = (h.readUInt16BE(0) / 65535) * 2 * Math.PI;
  const distKm = 0.25 + (h.readUInt16BE(2) / 65535) * 0.3;
  const dLat = (distKm / 111.32) * Math.cos(angle);
  const dLng = (distKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { lat: round(lat + dLat), lng: round(lng + dLng), radiusM: 600 };
}

export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
