import { and, avg, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews, users } from "@/lib/db/schema";

export type RatingSummary = { avg: number | null; count: number };
const toSummary = (r?: { a: string | null; c: number }): RatingSummary => ({
  avg: r?.a ? Math.round(Number(r.a) * 10) / 10 : null,
  count: r?.c ?? 0,
});

export async function chargerRatings(chargerIds: string[]) {
  const m = new Map<string, RatingSummary>();
  if (!chargerIds.length) return m;
  const rows = await db
    .select({ id: reviews.chargerId, a: avg(reviews.rating), c: count() })
    .from(reviews)
    .where(and(inArray(reviews.chargerId, chargerIds), eq(reviews.direction, "taker_to_giver"), isNull(reviews.hiddenAt)))
    .groupBy(reviews.chargerId);
  for (const r of rows) if (r.id) m.set(r.id, toSummary(r));
  return m;
}

/** Ratings received by users, optionally filtered by the direction (as host or as driver). */
export async function userRatings(userIds: string[], direction?: "taker_to_giver" | "giver_to_taker") {
  const m = new Map<string, RatingSummary>();
  if (!userIds.length) return m;
  const rows = await db
    .select({ id: reviews.subjectUserId, a: avg(reviews.rating), c: count() })
    .from(reviews)
    .where(and(inArray(reviews.subjectUserId, userIds), isNull(reviews.hiddenAt), direction ? eq(reviews.direction, direction) : undefined))
    .groupBy(reviews.subjectUserId);
  for (const r of rows) m.set(r.id, toSummary(r));
  return m;
}

export async function recentReviewsForCharger(chargerId: string, limit = 10) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      authorName: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorId))
    .where(and(eq(reviews.chargerId, chargerId), eq(reviews.direction, "taker_to_giver"), isNull(reviews.hiddenAt)))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}
