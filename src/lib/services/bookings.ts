import { and, desc, eq, gt, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import {
  batteryReadings,
  bookingSlotLocks,
  bookings,
  chargerPhotos,
  chargers,
  chargingSessions,
  invoices,
  payments,
  reviews,
  users,
  vehicles,
  type Booking,
} from "@/lib/db/schema";
import { config } from "@/lib/config";
import { bookingReference } from "@/lib/codes";
import { BOOKING_HORIZON_DAYS, isLateCancellation, MAX_BOOKING_SLOTS } from "@/lib/constants";
import { AppError, forbidden, invalid, isUniqueViolation, notFound } from "@/lib/errors";
import { assertTransition, bookingTransitions, type BookingStatus } from "@/lib/state";
import { fmtRange, localDate, rangeIsAvailable, slotStartsFor } from "@/lib/time";
import { photoUrl } from "@/lib/storage";
import { loadAvailability, slotsFor } from "./availability";
import { audit, notify } from "./notify";

export type CreateBookingInput = {
  chargerId: string;
  vehicleId: string;
  startAt: string | Date;
  slotCount: number;
  note?: string;
  idempotencyKey?: string;
};

const OPEN: BookingStatus[] = ["pending", "confirmed"];

async function setBookingStatus(
  tx: Tx,
  b: Pick<Booking, "id" | "status">,
  to: BookingStatus,
  actorId: string | null,
  patch: Partial<typeof bookings.$inferInsert> = {},
  meta?: Record<string, unknown>,
) {
  assertTransition("booking", bookingTransitions, b.status as BookingStatus, to);
  // Optimistic guard: only update if the status hasn't changed underneath us.
  const res = await tx
    .update(bookings)
    .set({ ...patch, status: to, updatedAt: new Date() })
    .where(and(eq(bookings.id, b.id), eq(bookings.status, b.status)))
    .returning({ id: bookings.id });
  if (!res.length) throw new AppError("CONFLICT", "This booking was just updated by someone else. Refresh and try again.");
  await audit(tx, { actorId, entityType: "booking", entityId: b.id, action: `status:${to}`, fromStatus: b.status, toStatus: to, meta });
}

/** Reserve the booking's slots and create its charging session. Must run inside a transaction. */
async function confirmInTx(tx: Tx, b: Booking, actorId: string | null, note?: string) {
  const [charger] = await tx.select().from(chargers).where(eq(chargers.id, b.chargerId));
  const starts = slotStartsFor(b.startAt, b.endAt, charger.slotMinutes);
  // Primary key (charger_id, slot_start) guarantees no two confirmed bookings share a slot.
  await tx.insert(bookingSlotLocks).values(starts.map((slotStart) => ({ chargerId: b.chargerId, slotStart, bookingId: b.id })));
  await setBookingStatus(tx, b, "confirmed", actorId, { decidedAt: new Date(), decisionNote: note ?? null });
  await tx.insert(chargingSessions).values({ bookingId: b.id, status: "awaiting_start" });

  // Any other pending requests for the same time can no longer be honoured.
  const clashes = await tx
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.chargerId, b.chargerId),
        eq(bookings.status, "pending"),
        ne(bookings.id, b.id),
        lt(bookings.startAt, b.endAt),
        gt(bookings.endAt, b.startAt),
      ),
    );
  for (const c of clashes) {
    await setBookingStatus(tx, c, "rejected", actorId, { decidedAt: new Date(), decisionNote: "This time was booked by another driver." });
    await notify(tx, c.takerId, "booking_rejected", "Booking request declined", `${c.reference}: the slot you requested is no longer available.`, `/bookings/${c.id}`);
  }

  const when = fmtRange(b.startAt, b.endAt, charger.timezone);
  await notify(tx, b.takerId, "booking_approved", "Booking confirmed", `${b.reference} at ${charger.title} — ${when}. The address and access instructions are now in your booking.`, `/bookings/${b.id}`);
  await notify(tx, b.giverId, "booking_approved", "Booking confirmed", `${b.reference} — ${when}. The slot is now reserved.`, `/host/bookings/${b.id}`);
}

export async function createBooking(takerId: string, input: CreateBookingInput, now = new Date()) {
  const startAt = new Date(input.startAt);
  const slotCount = Number(input.slotCount);
  if (Number.isNaN(startAt.getTime())) throw invalid("Choose a start time");
  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > MAX_BOOKING_SLOTS)
    throw invalid(`Choose between 1 and ${MAX_BOOKING_SLOTS} slots`);
  const idempotencyKey = input.idempotencyKey?.slice(0, 80) || null;

  if (idempotencyKey) {
    const [existing] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.takerId, takerId), eq(bookings.idempotencyKey, idempotencyKey)));
    if (existing) return existing;
  }

  try {
    return await db.transaction(async (tx) => {
      const [charger] = await tx.select().from(chargers).where(eq(chargers.id, input.chargerId));
      if (!charger || charger.status !== "active") throw new AppError("INVALID_STATE", "This charger isn't accepting bookings right now");
      if (charger.ownerId === takerId) throw forbidden("You can't book your own charger");
      const [owner] = await tx.select().from(users).where(eq(users.id, charger.ownerId));
      if (!owner || owner.suspendedAt || !owner.phoneVerifiedAt) throw new AppError("INVALID_STATE", "This charger isn't accepting bookings right now");

      const [vehicle] = await tx
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.userId, takerId), isNull(vehicles.deletedAt)));
      if (!vehicle) throw invalid("Choose one of your registered vehicles", { vehicleId: "Select a vehicle" });
      const connector = charger.connectors.find((c) => vehicle.connectors.includes(c));
      if (!connector)
        throw invalid("This charger's connectors aren't compatible with your vehicle", { vehicleId: "Incompatible connector" });

      const endAt = new Date(startAt.getTime() + slotCount * charger.slotMinutes * 60_000);
      if (startAt <= now) throw invalid("That time has already passed");
      if (startAt.getTime() - now.getTime() > BOOKING_HORIZON_DAYS * 86400_000)
        throw invalid(`Bookings can be made up to ${BOOKING_HORIZON_DAYS} days ahead`);

      const d1 = localDate(startAt, charger.timezone);
      const d2 = localDate(new Date(endAt.getTime() - 1), charger.timezone);
      const ctx = await loadAvailability([charger.id], d1, d2, charger.timezone, tx);
      const slots = d1 === d2 ? slotsFor(charger, d1, ctx, now) : [...slotsFor(charger, d1, ctx, now), ...slotsFor(charger, d2, ctx, now)];
      let ok = false;
      try {
        ok = rangeIsAvailable(slots, startAt, endAt, charger.slotMinutes);
      } catch {
        ok = false;
      }
      if (!ok) throw new AppError("CONFLICT", "Some of the selected time is no longer available. Pick another slot.");

      const overlapping = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.takerId, takerId), inArray(bookings.status, OPEN), lt(bookings.startAt, endAt), gt(bookings.endAt, startAt)))
        .limit(1);
      if (overlapping.length) throw new AppError("CONFLICT", "You already have a booking or request that overlaps this time");

      const [b] = await tx
        .insert(bookings)
        .values({
          reference: bookingReference(),
          chargerId: charger.id,
          takerId,
          giverId: charger.ownerId,
          vehicleId: vehicle.id,
          startAt,
          endAt,
          status: "pending",
          pricePerKwhPaise: charger.pricePerKwhPaise,
          platformFeeBps: config.billing.platformFeeBps,
          platformFeeFixedPaise: config.billing.platformFeeFixedPaise,
          taxBps: config.billing.taxBps,
          vehicleBatteryKwh: vehicle.batteryKwh,
          vehicleLabel: `${vehicle.name} · ${vehicle.model}`,
          connector,
          cancellationPolicy: charger.cancellationPolicy,
          bookingMode: charger.bookingMode,
          takerNote: (input.note ?? "").trim().slice(0, 500),
          idempotencyKey,
        })
        .returning();
      await audit(tx, { actorId: takerId, entityType: "booking", entityId: b.id, action: "created", toStatus: "pending" });

      if (charger.bookingMode === "instant") {
        await confirmInTx(tx, b, null, "Instant booking");
      } else {
        await notify(
          tx,
          charger.ownerId,
          "booking_request",
          "New booking request",
          `${b.reference}: ${fmtRange(startAt, endAt, charger.timezone)} at ${charger.title}. Approve or decline it.`,
          `/host/bookings/${b.id}`,
        );
      }
      const [fresh] = await tx.select().from(bookings).where(eq(bookings.id, b.id));
      return fresh;
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      if (idempotencyKey) {
        const [existing] = await db
          .select()
          .from(bookings)
          .where(and(eq(bookings.takerId, takerId), eq(bookings.idempotencyKey, idempotencyKey)));
        if (existing) return existing;
      }
      throw new AppError("CONFLICT", "That slot was just booked by someone else. Pick another time.");
    }
    throw e;
  }
}

export async function decideBooking(giverId: string, bookingId: string, decision: "approve" | "reject", note?: string, now = new Date()) {
  const cleanNote = note?.trim().slice(0, 500) || undefined;
  try {
    await db.transaction(async (tx) => {
      const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
      if (!b) throw notFound("Booking");
      if (b.giverId !== giverId) throw forbidden();
      if (b.status !== "pending") throw new AppError("INVALID_STATE", `This request is already ${b.status}`);
      if (b.startAt <= now) {
        await setBookingStatus(tx, b, "expired", null);
        throw new AppError("INVALID_STATE", "This request's start time has passed, so it expired");
      }
      if (decision === "approve") await confirmInTx(tx, b, giverId, cleanNote);
      else {
        await setBookingStatus(tx, b, "rejected", giverId, { decidedAt: now, decisionNote: cleanNote ?? null });
        await notify(tx, b.takerId, "booking_rejected", "Booking request declined", `${b.reference} was declined by the host${cleanNote ? `: “${cleanNote}”` : "."}`, `/bookings/${b.id}`);
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Another booking already holds part of this time — decline automatically.
      await db.transaction(async (tx) => {
        const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
        if (b?.status === "pending") {
          await setBookingStatus(tx, b, "rejected", giverId, { decidedAt: now, decisionNote: "This time was already booked." });
          await notify(tx, b.takerId, "booking_rejected", "Booking request declined", `${b.reference}: the slot is no longer available.`, `/bookings/${b.id}`);
        }
      });
      throw new AppError("CONFLICT", "Part of this time is already booked, so the request was declined automatically.");
    }
    throw e;
  }
}

export async function cancelBooking(userId: string, bookingId: string, reason: string, now = new Date()) {
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!b) throw notFound("Booking");
    const isTaker = b.takerId === userId;
    const isGiver = b.giverId === userId;
    if (!isTaker && !isGiver) throw forbidden();
    if (b.status !== "pending" && b.status !== "confirmed") throw new AppError("INVALID_STATE", `This booking is already ${b.status}`);

    let late = false;
    if (b.status === "confirmed") {
      const [s] = await tx.select().from(chargingSessions).where(eq(chargingSessions.bookingId, b.id)).for("update");
      if (s && (s.status !== "awaiting_start" || s.codeVerifiedAt))
        throw new AppError("INVALID_STATE", "Charging has already started — this booking can't be cancelled. Use Help to report a problem.");
      late = isTaker && isLateCancellation(b.startAt, b.cancellationPolicy, now);
      await tx.delete(bookingSlotLocks).where(eq(bookingSlotLocks.bookingId, b.id));
    }
    await setBookingStatus(tx, b, "cancelled", userId, {
      cancelledBy: userId,
      cancelReason: reason.trim().slice(0, 500) || null,
      lateCancellation: late,
    });
    const other = isTaker ? b.giverId : b.takerId;
    const who = isTaker ? "The driver" : "The host";
    await notify(
      tx,
      other,
      "booking_cancelled",
      "Booking cancelled",
      `${who} cancelled ${b.reference}${late ? " (late cancellation)" : ""}${reason.trim() ? `: “${reason.trim().slice(0, 140)}”` : "."}`,
      isTaker ? `/host/bookings/${b.id}` : `/bookings/${b.id}`,
    );
  });
}

/** Lazily-run housekeeping: expire stale requests and send upcoming-session reminders. */
export async function runBookingMaintenance(now = new Date()) {
  const stale = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "pending"), lte(bookings.startAt, now)))
    .limit(200);
  for (const b of stale) {
    await db.transaction(async (tx) => {
      const [cur] = await tx.select().from(bookings).where(eq(bookings.id, b.id)).for("update");
      if (cur?.status !== "pending") return;
      await setBookingStatus(tx, cur, "expired", null);
      await notify(tx, cur.takerId, "booking_expired", "Booking request expired", `${cur.reference} wasn't answered before its start time.`, `/bookings/${cur.id}`);
    });
  }

  const soon = await db
    .select({ b: bookings, title: chargers.title, tz: chargers.timezone })
    .from(bookings)
    .innerJoin(chargers, eq(chargers.id, bookings.chargerId))
    .where(
      and(
        eq(bookings.status, "confirmed"),
        isNull(bookings.reminderSentAt),
        gt(bookings.startAt, now),
        lte(bookings.startAt, new Date(now.getTime() + 2 * 3600_000)),
      ),
    )
    .limit(200);
  for (const { b, title, tz } of soon) {
    await db.transaction(async (tx) => {
      const res = await tx
        .update(bookings)
        .set({ reminderSentAt: now })
        .where(and(eq(bookings.id, b.id), isNull(bookings.reminderSentAt)))
        .returning({ id: bookings.id });
      if (!res.length) return;
      const when = fmtRange(b.startAt, b.endAt, tz);
      await notify(tx, b.takerId, "session_upcoming", "Upcoming charging session", `${b.reference} at ${title} — ${when}. Open your booking when you arrive to show your code.`, `/bookings/${b.id}`);
      await notify(tx, b.giverId, "session_upcoming", "Upcoming charging session", `${b.reference} — ${when}. Ask the driver for their code on arrival.`, `/host/bookings/${b.id}`);
    });
  }
  return { expired: stale.length, reminded: soon.length };
}

/* ----------------------------------------------------------------------------
 * Reads
 * --------------------------------------------------------------------------*/

/** May this viewer see the exact address / access instructions? */
export function canSeePrivateLocation(role: "taker" | "giver" | "admin", status: BookingStatus) {
  if (role !== "taker") return true;
  return status === "confirmed" || status === "completed";
}

export async function getBookingForUser(userId: string, bookingId: string, opts: { admin?: boolean } = {}) {
  const [row] = await db
    .select({ b: bookings, c: chargers })
    .from(bookings)
    .innerJoin(chargers, eq(chargers.id, bookings.chargerId))
    .where(eq(bookings.id, bookingId));
  if (!row) throw notFound("Booking");
  const { b, c } = row;
  const role: "taker" | "giver" | "admin" | null =
    b.takerId === userId ? "taker" : b.giverId === userId ? "giver" : opts.admin ? "admin" : null;
  if (!role) throw notFound("Booking"); // don't reveal existence to other users

  const [session] = await db.select().from(chargingSessions).where(eq(chargingSessions.bookingId, b.id));
  const readings = session ? await db.select().from(batteryReadings).where(eq(batteryReadings.sessionId, session.id)) : [];
  const [invoice] = await db.select().from(invoices).where(eq(invoices.bookingId, b.id));
  const paymentRows = invoice
    ? await db.select().from(payments).where(eq(payments.invoiceId, invoice.id)).orderBy(desc(payments.createdAt))
    : [];
  const [taker] = await db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(eq(users.id, b.takerId));
  const [giver] = await db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(eq(users.id, b.giverId));
  const reviewRows = await db.select().from(reviews).where(eq(reviews.bookingId, b.id));
  const [photo] = await db.select().from(chargerPhotos).where(eq(chargerPhotos.chargerId, c.id)).orderBy(chargerPhotos.sortOrder).limit(1);

  const showPrivate = canSeePrivateLocation(role, b.status as BookingStatus);
  const contactShared = b.status === "confirmed" || b.status === "completed";
  const start = readings.find((r) => r.kind === "start");
  const end = readings.find((r) => r.kind === "end");

  return {
    role,
    booking: b,
    charger: {
      id: c.id,
      title: c.title,
      locality: c.locality,
      city: c.city,
      timezone: c.timezone,
      powerKw: c.powerKw,
      connectors: c.connectors,
      photo: photo ? photoUrl(photo.storageKey) : null,
      parkingInfo: c.parkingInfo,
      safetyInfo: c.safetyInfo,
      private: showPrivate
        ? { addressLine: c.addressLine, postalCode: c.postalCode, state: c.state, lat: c.lat, lng: c.lng, accessInstructions: c.accessInstructions }
        : null,
    },
    session: session ?? null,
    readings: { start: start ?? null, end: end ?? null },
    invoice: invoice ?? null,
    payments: paymentRows,
    taker: { id: taker.id, name: taker.name, phone: contactShared && role !== "taker" ? taker.phone : null },
    giver: { id: giver.id, name: giver.name, phone: contactShared && role !== "giver" ? giver.phone : null },
    myReview: reviewRows.find((r) => r.authorId === userId) ?? null,
    theirReview: reviewRows.find((r) => r.authorId !== userId && !r.hiddenAt) ?? null,
  };
}
export type BookingDetail = Awaited<ReturnType<typeof getBookingForUser>>;

export type BookingTab = "requests" | "upcoming" | "active" | "past" | "cancelled" | "all";

export async function listBookings(userId: string, as: "taker" | "giver", tab: BookingTab = "all", now = new Date()) {
  const who = as === "taker" ? eq(bookings.takerId, userId) : eq(bookings.giverId, userId);
  const rows = await db
    .select({
      b: bookings,
      chargerTitle: chargers.title,
      locality: chargers.locality,
      city: chargers.city,
      tz: chargers.timezone,
      sessionStatus: chargingSessions.status,
      totalPaise: invoices.totalPaise,
      billableWh: invoices.billableWh,
      startPercent: invoices.startPercent,
      endPercent: invoices.endPercent,
      invoiceStatus: invoices.status,
      takerName: sql<string>`(select name from users where users.id = ${bookings.takerId})`,
    })
    .from(bookings)
    .innerJoin(chargers, eq(chargers.id, bookings.chargerId))
    .leftJoin(chargingSessions, eq(chargingSessions.bookingId, bookings.id))
    .leftJoin(invoices, eq(invoices.bookingId, bookings.id))
    .where(
      and(
        who,
        tab === "requests"
          ? eq(bookings.status, "pending")
          : tab === "upcoming"
            ? and(eq(bookings.status, "confirmed"), eq(chargingSessions.status, "awaiting_start"))
            : tab === "active"
              ? and(eq(bookings.status, "confirmed"), ne(chargingSessions.status, "awaiting_start"))
              : tab === "past"
                ? eq(bookings.status, "completed")
                : tab === "cancelled"
                  ? or(eq(bookings.status, "cancelled"), eq(bookings.status, "rejected"), eq(bookings.status, "expired"))
                  : undefined,
      ),
    )
    .orderBy(tab === "past" || tab === "cancelled" || tab === "all" ? desc(bookings.startAt) : bookings.startAt)
    .limit(200);
  void now;
  return rows;
}
export type BookingListRow = Awaited<ReturnType<typeof listBookings>>[number];
