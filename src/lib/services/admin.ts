import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  adminActions,
  bookingSlotLocks,
  bookings,
  chargers,
  chargingSessions,
  disputes,
  payouts,
  reviewReports,
  reviews,
  sessions,
  users,
} from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { audit, notify } from "./notify";

async function log(adminId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) {
  await db.insert(adminActions).values({ adminId, action, targetType, targetId, details });
}

export async function adminStats() {
  const [[u], [c], [b], [d], [r], [p]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(chargers).where(eq(chargers.status, "active")),
    db.select({ n: count() }).from(bookings),
    db.select({ n: count() }).from(disputes).where(inArray(disputes.status, ["open", "investigating"])),
    db.select({ n: count() }).from(reviewReports).where(eq(reviewReports.status, "open")),
    db.select({ n: count() }).from(payouts).where(inArray(payouts.status, ["requested", "processing"])),
  ]);
  return { users: u.n, activeChargers: c.n, bookings: b.n, openDisputes: d.n, openReports: r.n, pendingPayouts: p.n };
}

export async function adminListUsers(q?: string) {
  return db
    .select()
    .from(users)
    .where(q ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), ilike(users.phone, `%${q}%`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(200);
}

export async function adminSetSuspended(adminId: string, userId: string, suspend: boolean) {
  if (adminId === userId) throw new AppError("VALIDATION", "You can't suspend yourself");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ suspendedAt: suspend ? new Date() : null }).where(eq(users.id, userId));
    if (suspend) {
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.update(chargers).set({ status: "paused" }).where(and(eq(chargers.ownerId, userId), eq(chargers.status, "active")));
    }
  });
  await log(adminId, suspend ? "suspend_user" : "unsuspend_user", "user", userId);
}

export async function adminListChargers() {
  return db
    .select({ c: chargers, ownerName: users.name, ownerEmail: users.email })
    .from(chargers)
    .innerJoin(users, eq(users.id, chargers.ownerId))
    .orderBy(desc(chargers.createdAt))
    .limit(300);
}

export async function adminSetChargerStatus(adminId: string, chargerId: string, status: "paused" | "removed" | "active") {
  const [c] = await db.select().from(chargers).where(eq(chargers.id, chargerId));
  if (!c) throw notFound("Charger");
  await db.update(chargers).set({ status, updatedAt: new Date() }).where(eq(chargers.id, chargerId));
  await audit(db, { actorId: adminId, entityType: "charger", entityId: chargerId, action: "admin_status", fromStatus: c.status, toStatus: status });
  await notify(db, c.ownerId, "listing_update", "Listing status changed by Eber", `“${c.title}” is now ${status}. Contact support if you have questions.`, "/host/chargers");
  await log(adminId, "set_charger_status", "charger", chargerId, { status });
}

export async function adminListBookings(q?: string) {
  return db
    .select({
      b: bookings,
      chargerTitle: chargers.title,
      sessionStatus: chargingSessions.status,
      takerName: sql<string>`(select name from users where users.id = ${bookings.takerId})`,
      giverName: sql<string>`(select name from users where users.id = ${bookings.giverId})`,
    })
    .from(bookings)
    .innerJoin(chargers, eq(chargers.id, bookings.chargerId))
    .leftJoin(chargingSessions, eq(chargingSessions.bookingId, bookings.id))
    .where(q ? ilike(bookings.reference, `%${q}%`) : undefined)
    .orderBy(desc(bookings.createdAt))
    .limit(300);
}

/** Admin cancel — only before charging starts. */
export async function adminCancelBooking(adminId: string, bookingId: string, reason: string) {
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!b) throw notFound("Booking");
    if (b.status !== "pending" && b.status !== "confirmed") throw new AppError("INVALID_STATE", `Booking is ${b.status}`);
    const [s] = await tx.select().from(chargingSessions).where(eq(chargingSessions.bookingId, b.id));
    if (s && (s.status !== "awaiting_start" || s.codeVerifiedAt)) throw new AppError("INVALID_STATE", "Charging already started — resolve via dispute");
    await tx.delete(bookingSlotLocks).where(eq(bookingSlotLocks.bookingId, b.id));
    await tx.update(bookings).set({ status: "cancelled", cancelledBy: adminId, cancelReason: `Cancelled by Eber: ${reason}`, updatedAt: new Date() }).where(eq(bookings.id, b.id));
    await audit(tx, { actorId: adminId, entityType: "booking", entityId: b.id, action: "admin_cancel", fromStatus: b.status, toStatus: "cancelled" });
    for (const [uid, link] of [[b.takerId, `/bookings/${b.id}`], [b.giverId, `/host/bookings/${b.id}`]] as const)
      await notify(tx, uid, "booking_cancelled", "Booking cancelled by Eber", `${b.reference}: ${reason}`, link);
  });
  await log(adminId, "cancel_booking", "booking", bookingId, { reason });
}

export async function adminListReports() {
  return db
    .select({
      report: reviewReports,
      review: reviews,
      reporterName: sql<string>`(select name from users where users.id = ${reviewReports.reporterId})`,
      authorName: sql<string>`(select name from users where users.id = ${reviews.authorId})`,
    })
    .from(reviewReports)
    .innerJoin(reviews, eq(reviews.id, reviewReports.reviewId))
    .orderBy(desc(reviewReports.createdAt))
    .limit(200);
}

export async function adminResolveReport(adminId: string, reportId: string, action: "hide" | "dismiss") {
  const [r] = await db.select().from(reviewReports).where(eq(reviewReports.id, reportId));
  if (!r) throw notFound("Report");
  await db.transaction(async (tx) => {
    if (action === "hide") {
      await tx.update(reviews).set({ hiddenAt: new Date() }).where(eq(reviews.id, r.reviewId));
      await tx.update(reviewReports).set({ status: "actioned" }).where(eq(reviewReports.reviewId, r.reviewId));
    } else await tx.update(reviewReports).set({ status: "dismissed" }).where(eq(reviewReports.id, reportId));
  });
  await log(adminId, `report_${action}`, "review", r.reviewId);
}

export async function adminListDisputes() {
  return db
    .select({ d: disputes, reference: bookings.reference, reporterName: users.name, reporterEmail: users.email })
    .from(disputes)
    .innerJoin(users, eq(users.id, disputes.reporterId))
    .leftJoin(bookings, eq(bookings.id, disputes.bookingId))
    .orderBy(desc(disputes.createdAt))
    .limit(300);
}

export async function adminUpdateDispute(adminId: string, id: string, status: "open" | "investigating" | "resolved" | "dismissed", resolution: string) {
  const [d] = await db.select().from(disputes).where(eq(disputes.id, id));
  if (!d) throw notFound("Dispute");
  await db.update(disputes).set({ status, resolution: resolution.trim() || d.resolution, updatedAt: new Date() }).where(eq(disputes.id, id));
  await notify(db, d.reporterId, "dispute_update", "Update on your report", `Status: ${status}${resolution.trim() ? ` — ${resolution.trim().slice(0, 200)}` : ""}`, "/help");
  await log(adminId, "update_dispute", "dispute", id, { status });
}

export async function adminListPayouts() {
  return db
    .select({ p: payouts, giverName: users.name, giverEmail: users.email })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.giverId))
    .orderBy(desc(payouts.createdAt))
    .limit(300);
}

export async function adminRecentActions() {
  return db
    .select({ a: adminActions, adminName: users.name })
    .from(adminActions)
    .innerJoin(users, eq(users.id, adminActions.adminId))
    .orderBy(desc(adminActions.createdAt))
    .limit(50);
}
