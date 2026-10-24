import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, chargers, chargingSessions, invoices, reviewReports, reviews, users } from "@/lib/db/schema";
import { AppError, invalid, isUniqueViolation, notFound } from "@/lib/errors";
import { notify } from "./notify";

/** Reviews open only once the session is completed after a verified (or ₹0) payment. */
export async function createReview(userId: string, bookingId: string, ratingRaw: unknown, commentRaw: unknown) {
  const rating = Number(ratingRaw);
  const comment = String(commentRaw ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw invalid("Choose a rating from 1 to 5 stars", { rating: "Required" });
  if (comment.length > 1000) throw invalid("Keep your review under 1000 characters", { comment: "Too long" });

  try {
    await db.transaction(async (tx) => {
      const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
      if (!b || (b.takerId !== userId && b.giverId !== userId)) throw notFound("Booking");
      const [s] = await tx.select().from(chargingSessions).where(eq(chargingSessions.bookingId, bookingId));
      const [inv] = await tx.select().from(invoices).where(eq(invoices.bookingId, bookingId));
      if (b.status !== "completed" || s?.status !== "completed" || inv?.status !== "paid")
        throw new AppError("INVALID_STATE", "You can leave a review once the session is completed and paid");
      const isTaker = b.takerId === userId;
      await tx.insert(reviews).values({
        bookingId,
        authorId: userId,
        subjectUserId: isTaker ? b.giverId : b.takerId,
        chargerId: isTaker ? b.chargerId : null,
        direction: isTaker ? "taker_to_giver" : "giver_to_taker",
        rating,
        comment,
      });
      await notify(
        tx,
        isTaker ? b.giverId : b.takerId,
        "review_received",
        "You received a new review",
        `${rating}★ for ${b.reference}${comment ? `: “${comment.slice(0, 100)}”` : ""}`,
        isTaker ? "/host/reviews" : "/reviews",
      );
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "You've already reviewed this booking");
    throw e;
  }
}

export async function reportReview(userId: string, reviewId: string, reasonRaw: unknown) {
  const reason = String(reasonRaw ?? "").trim();
  if (reason.length < 5) throw invalid("Tell us briefly what's wrong with this review", { reason: "Required" });
  const [r] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  if (!r || r.hiddenAt) throw notFound("Review");
  if (r.authorId === userId) throw invalid("You can't report your own review");
  try {
    await db.insert(reviewReports).values({ reviewId, reporterId: userId, reason: reason.slice(0, 500) });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "You've already reported this review");
    throw e;
  }
}

export async function reviewsAbout(userId: string, direction: "taker_to_giver" | "giver_to_taker") {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      authorName: users.name,
      bookingRef: bookings.reference,
      chargerTitle: chargers.title,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorId))
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .leftJoin(chargers, eq(chargers.id, bookings.chargerId))
    .where(and(eq(reviews.subjectUserId, userId), eq(reviews.direction, direction), isNull(reviews.hiddenAt)))
    .orderBy(desc(reviews.createdAt));
}

export async function reviewsBy(userId: string) {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      direction: reviews.direction,
      bookingRef: bookings.reference,
      bookingId: bookings.id,
      subjectName: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.subjectUserId))
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .where(eq(reviews.authorId, userId))
    .orderBy(desc(reviews.createdAt));
}
