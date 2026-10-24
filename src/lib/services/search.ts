import { and, asc, between, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { availabilityRules, chargerPhotos, chargers, users, vehicles } from "@/lib/db/schema";
import { approximateLocation, boundingBox, haversineKm } from "@/lib/geo";
import { config } from "@/lib/config";
import { addDays, DEFAULT_TZ, localDate, type Slot } from "@/lib/time";
import { photoUrl } from "@/lib/storage";
import { loadAvailability, nextAvailable, slotsFor } from "./availability";
import { chargerRatings, recentReviewsForCharger, userRatings, type RatingSummary } from "./ratings";
import { notFound } from "@/lib/errors";

export type SearchParams = {
  lat: number;
  lng: number;
  radiusKm?: number;
  maxPricePaise?: number;
  connectors?: string[];
  minPowerKw?: number;
  date?: string; // YYYY-MM-DD local
  fromMinute?: number;
  toMinute?: number;
  vehicleId?: string;
  viewerId?: string;
  sort?: "distance" | "price" | "rating";
};

export type ChargerSummary = {
  id: string;
  title: string;
  locality: string;
  city: string;
  approx: { lat: number; lng: number; radiusM: number };
  distanceKm: number;
  pricePerKwhPaise: number;
  powerKw: number;
  connectors: string[];
  rating: RatingSummary;
  hostRating: RatingSummary;
  hostFirstName: string;
  photo: string | null;
  bookingMode: "approval" | "instant";
  nextSlot: { start: string; end: string } | null;
  slotsOnDate: number | null;
  compatible: boolean | null;
  isOwn: boolean;
  available: boolean;
};

const firstName = (n: string) => n.split(/\s+/)[0];

export async function searchChargers(p: SearchParams): Promise<{ results: ChargerSummary[]; radiusKm: number }> {
  const radiusKm = Math.min(Math.max(p.radiusKm ?? config.defaultSearchRadiusKm, 1), 100);
  const bb = boundingBox(p.lat, p.lng, radiusKm + 1);
  const rows = await db
    .select({ c: chargers, ownerName: users.name })
    .from(chargers)
    .innerJoin(users, eq(users.id, chargers.ownerId))
    .where(and(eq(chargers.status, "active"), between(chargers.lat, bb.minLat, bb.maxLat), between(chargers.lng, bb.minLng, bb.maxLng)))
    .limit(500);

  let vehicleConnectors: string[] | null = null;
  if (p.vehicleId && p.viewerId) {
    const [v] = await db.select().from(vehicles).where(and(eq(vehicles.id, p.vehicleId), eq(vehicles.userId, p.viewerId)));
    vehicleConnectors = v?.connectors ?? null;
  }

  const salt = config.secret;
  const list = rows
    .map(({ c, ownerName }) => {
      const approx = approximateLocation(c.id, c.lat, c.lng, salt);
      return { c, ownerName, approx, distanceKm: haversineKm({ lat: p.lat, lng: p.lng }, approx) };
    })
    .filter((x) => x.distanceKm <= radiusKm)
    .filter((x) => (p.maxPricePaise ? x.c.pricePerKwhPaise <= p.maxPricePaise : true))
    .filter((x) => (p.minPowerKw ? x.c.powerKw >= p.minPowerKw : true))
    .filter((x) => (p.connectors?.length ? x.c.connectors.some((k) => p.connectors!.includes(k)) : true))
    .filter((x) => (vehicleConnectors ? x.c.connectors.some((k) => vehicleConnectors!.includes(k)) : true));

  const ids = list.map((x) => x.c.id);
  const today = localDate(new Date(), DEFAULT_TZ);
  const toDate = p.date && p.date > addDays(today, 6) ? p.date : addDays(today, 6);
  const [ctx, ratings, hostRatings, photos] = await Promise.all([
    loadAvailability(ids, p.date && p.date < today ? p.date : today, toDate, DEFAULT_TZ),
    chargerRatings(ids),
    userRatings([...new Set(list.map((x) => x.c.ownerId))], "taker_to_giver"),
    ids.length
      ? db.select().from(chargerPhotos).where(inArray(chargerPhotos.chargerId, ids)).orderBy(asc(chargerPhotos.sortOrder))
      : Promise.resolve([]),
  ]);

  const now = new Date();
  let results: ChargerSummary[] = list.map(({ c, ownerName, approx, distanceKm }) => {
    let slotsOnDate: number | null = null;
    let next: Slot | null;
    if (p.date) {
      const daySlots = slotsFor(c, p.date, ctx, now).filter(
        (s) =>
          s.available &&
          (p.fromMinute === undefined || minuteOf(s.start, c.timezone) >= p.fromMinute) &&
          (p.toMinute === undefined || minuteOf(s.end, c.timezone) <= p.toMinute || minuteOf(s.end, c.timezone) === 0),
      );
      slotsOnDate = daySlots.length;
      next = daySlots[0] ?? null;
    } else next = nextAvailable(c, ctx, 7, now);
    const photo = photos.find((ph) => ph.chargerId === c.id);
    return {
      id: c.id,
      title: c.title,
      locality: c.locality,
      city: c.city,
      approx,
      distanceKm: Math.round(distanceKm * 10) / 10,
      pricePerKwhPaise: c.pricePerKwhPaise,
      powerKw: c.powerKw,
      connectors: c.connectors,
      rating: ratings.get(c.id) ?? { avg: null, count: 0 },
      hostRating: hostRatings.get(c.ownerId) ?? { avg: null, count: 0 },
      hostFirstName: firstName(ownerName),
      photo: photo ? photoUrl(photo.storageKey) : null,
      bookingMode: c.bookingMode,
      nextSlot: next ? { start: next.start.toISOString(), end: next.end.toISOString() } : null,
      slotsOnDate,
      compatible: vehicleConnectors ? true : null,
      isOwn: c.ownerId === p.viewerId,
      available: Boolean(next),
    };
  });

  if (p.date) results = results.filter((r) => (r.slotsOnDate ?? 0) > 0);
  const sort = p.sort ?? "distance";
  results.sort((a, b) =>
    sort === "price"
      ? a.pricePerKwhPaise - b.pricePerKwhPaise || a.distanceKm - b.distanceKm
      : sort === "rating"
        ? (b.rating.avg ?? 0) - (a.rating.avg ?? 0) || a.distanceKm - b.distanceKm
        : Number(b.available) - Number(a.available) || a.distanceKm - b.distanceKm,
  );
  return { results, radiusKm };
}

function minuteOf(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const h = Number(parts.find((x) => x.type === "hour")?.value);
  const m = Number(parts.find((x) => x.type === "minute")?.value);
  return h * 60 + m;
}

/** Public listing details — never includes the exact address, coordinates or access instructions. */
export async function getPublicCharger(id: string, viewerId?: string) {
  const [row] = await db
    .select({ c: chargers, owner: { id: users.id, name: users.name, createdAt: users.createdAt, phoneVerifiedAt: users.phoneVerifiedAt } })
    .from(chargers)
    .innerJoin(users, eq(users.id, chargers.ownerId))
    .where(eq(chargers.id, id));
  if (!row || row.c.status === "removed") throw notFound("Charger");
  const isOwner = row.c.ownerId === viewerId;
  if (row.c.status !== "active" && !isOwner) throw notFound("Charger");
  const c = row.c;
  const [photos, rules, ratings, hostRatings, reviews] = await Promise.all([
    db.select().from(chargerPhotos).where(eq(chargerPhotos.chargerId, id)).orderBy(asc(chargerPhotos.sortOrder)),
    db.select().from(availabilityRules).where(eq(availabilityRules.chargerId, id)),
    chargerRatings([id]),
    userRatings([c.ownerId], "taker_to_giver"),
    recentReviewsForCharger(id),
  ]);
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    locality: c.locality,
    city: c.city,
    state: c.state,
    approx: approximateLocation(c.id, c.lat, c.lng, config.secret),
    timezone: c.timezone,
    connectors: c.connectors,
    powerKw: c.powerKw,
    pricePerKwhPaise: c.pricePerKwhPaise,
    parkingInfo: c.parkingInfo,
    safetyInfo: c.safetyInfo,
    amenities: c.amenities,
    status: c.status,
    bookingMode: c.bookingMode,
    cancellationPolicy: c.cancellationPolicy,
    slotMinutes: c.slotMinutes,
    photos: photos.map((p) => ({ id: p.id, url: photoUrl(p.storageKey) })),
    rules: rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute })),
    rating: ratings.get(id) ?? { avg: null, count: 0 },
    host: {
      firstName: firstName(row.owner.name),
      memberSince: row.owner.createdAt,
      phoneVerified: Boolean(row.owner.phoneVerifiedAt),
      rating: hostRatings.get(c.ownerId) ?? { avg: null, count: 0 },
    },
    reviews: reviews.map((r) => ({ ...r, authorName: firstName(r.authorName) })),
    isOwner,
  };
}
export type PublicCharger = Awaited<ReturnType<typeof getPublicCharger>>;
