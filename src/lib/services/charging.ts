/**
 * Shared-code charging workflow.
 *
 *  awaiting_start ──(taker shows code, giver verifies)──► codeVerifiedAt set
 *        │
 *        └──(giver records start %)──► active ──(giver records end %)──► awaiting_payment
 *                                                                          │
 *                                         (verified payment via webhook) ──┴──► completed
 *
 * Every step re-checks ownership and state on the server inside a transaction.
 */
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import {
  batteryReadings,
  bookings,
  chargers,
  chargingSessions,
  confirmationCodes,
  invoices,
  type ChargingSession,
} from "@/lib/db/schema";
import { config } from "@/lib/config";
import { BillingError, calculateBill, validatePercent } from "@/lib/billing";
import { hmac, invoiceNumber, numericCode, safeEqualHex } from "@/lib/codes";
import { CODE_MAX_ATTEMPTS, CODE_TTL_MINUTES, CODE_WINDOW_AFTER_MIN, CODE_WINDOW_BEFORE_MIN } from "@/lib/constants";
import { AppError, invalid, notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { assertTransition, sessionTransitions, type SessionStatus } from "@/lib/state";
import { formatPaise, formatKwh } from "@/lib/money";
import { audit, notify } from "./notify";
import { completePaidSession } from "./payments";

const codeHash = (bookingId: string, code: string) => hmac(config.secret, `booking-code:${bookingId}:${code}`);

export async function setSessionStatus(
  tx: Tx,
  s: Pick<ChargingSession, "id" | "status">,
  to: SessionStatus,
  actorId: string | null,
  patch: Partial<typeof chargingSessions.$inferInsert> = {},
  meta?: Record<string, unknown>,
) {
  assertTransition("charging session", sessionTransitions, s.status as SessionStatus, to);
  const res = await tx
    .update(chargingSessions)
    .set({ ...patch, status: to, updatedAt: new Date() })
    .where(and(eq(chargingSessions.id, s.id), eq(chargingSessions.status, s.status)))
    .returning({ id: chargingSessions.id });
  if (!res.length) throw new AppError("CONFLICT", "This session was just updated. Refresh and try again.");
  if (s.status !== to)
    await audit(tx, { actorId, entityType: "session", entityId: s.id, action: `status:${to}`, fromStatus: s.status, toStatus: to, meta });
}

async function lockBookingAndSession(tx: Tx, bookingId: string) {
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!b) throw notFound("Booking");
  const [s] = await tx.select().from(chargingSessions).where(eq(chargingSessions.bookingId, bookingId)).for("update");
  return { b, s };
}

/** Is `now` within the window in which a start code may be shown / verified? */
export function inCodeWindow(b: { startAt: Date; endAt: Date }, now = new Date()) {
  return (
    now.getTime() >= b.startAt.getTime() - CODE_WINDOW_BEFORE_MIN * 60_000 &&
    now.getTime() <= b.endAt.getTime() + CODE_WINDOW_AFTER_MIN * 60_000
  );
}

/**
 * Charge taker: issue a fresh single-use code for this booking. Any earlier
 * unused code is revoked. Only the hash is stored.
 */
export async function issueStartCode(takerId: string, bookingId: string, now = new Date()) {
  rateLimit(`code:issue:${bookingId}`, 12, 3600_000);
  return db.transaction(async (tx) => {
    const { b, s } = await lockBookingAndSession(tx, bookingId);
    if (b.takerId !== takerId) throw notFound("Booking");
    if (b.status !== "confirmed" || !s) throw new AppError("INVALID_STATE", "Only confirmed bookings have a start code");
    if (s.status !== "awaiting_start" || s.codeVerifiedAt) throw new AppError("INVALID_STATE", "Your code has already been verified");
    if (!inCodeWindow(b, now))
      throw new AppError("INVALID_STATE", `Your code becomes available ${CODE_WINDOW_BEFORE_MIN} minutes before your slot starts`);

    await tx
      .update(confirmationCodes)
      .set({ revokedAt: now })
      .where(and(eq(confirmationCodes.bookingId, bookingId), isNull(confirmationCodes.usedAt), isNull(confirmationCodes.revokedAt)));
    const code = numericCode(6);
    const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);
    await tx.insert(confirmationCodes).values({ bookingId, codeHash: codeHash(bookingId, code), expiresAt });
    await audit(tx, { actorId: takerId, entityType: "booking", entityId: bookingId, action: "code_issued" });
    return { code, expiresAt };
  });
}

/**
 * Charge giver: verify the code the driver shows. The code is bound to this
 * booking (the booking id is part of the keyed hash), expires, is single-use,
 * and is revoked after CODE_MAX_ATTEMPTS wrong guesses.
 */
export async function verifyStartCode(giverId: string, bookingId: string, rawCode: string, now = new Date()) {
  const code = String(rawCode ?? "").replace(/\s+/g, "");
  rateLimit(`code:verify:giver:${giverId}`, 30, 15 * 60_000);
  if (!/^\d{6}$/.test(code)) throw invalid("Enter the 6-digit code shown on the driver's phone", { code: "6 digits" });

  const result = await db.transaction(async (tx) => {
    const { b, s } = await lockBookingAndSession(tx, bookingId);
    if (b.giverId !== giverId) throw notFound("Booking");
    if (b.status !== "confirmed" || !s) throw new AppError("INVALID_STATE", "This booking isn't confirmed");
    if (s.status !== "awaiting_start") throw new AppError("INVALID_STATE", "Charging has already started for this booking");
    if (s.codeVerifiedAt) return { ok: true as const };
    if (!inCodeWindow(b, now)) throw new AppError("INVALID_STATE", "Codes can only be verified around the booked time");

    const [active] = await tx
      .select()
      .from(confirmationCodes)
      .where(
        and(
          eq(confirmationCodes.bookingId, bookingId),
          isNull(confirmationCodes.usedAt),
          isNull(confirmationCodes.revokedAt),
          gt(confirmationCodes.expiresAt, now),
        ),
      )
      .orderBy(desc(confirmationCodes.createdAt))
      .limit(1)
      .for("update");
    if (!active) throw new AppError("INVALID_STATE", "There's no active code. Ask the driver to open their booking and show a fresh code.");

    if (!safeEqualHex(active.codeHash, codeHash(bookingId, code))) {
      const attempts = active.failedAttempts + 1;
      const revoke = attempts >= CODE_MAX_ATTEMPTS;
      await tx
        .update(confirmationCodes)
        .set({ failedAttempts: attempts, ...(revoke ? { revokedAt: now } : {}) })
        .where(eq(confirmationCodes.id, active.id));
      await audit(tx, { actorId: giverId, entityType: "booking", entityId: bookingId, action: "code_failed", meta: { attempts } });
      return {
        ok: false as const,
        message: revoke
          ? "Too many incorrect attempts. That code is now invalid — ask the driver to generate a new one."
          : `Incorrect code. ${CODE_MAX_ATTEMPTS - attempts} attempt(s) left.`,
      };
    }

    await tx.update(confirmationCodes).set({ usedAt: now }).where(eq(confirmationCodes.id, active.id));
    await tx.update(chargingSessions).set({ codeVerifiedAt: now, updatedAt: now }).where(eq(chargingSessions.id, s.id));
    await audit(tx, { actorId: giverId, entityType: "session", entityId: s.id, action: "code_verified" });
    return { ok: true as const };
  });
  // Failed attempts are committed (so the counter sticks) and then surfaced as an error.
  if (!result.ok) throw invalid(result.message, { code: "Incorrect code" });
}

/** Charge giver: record the starting battery percentage — this starts the session. */
export async function recordStartReading(giverId: string, bookingId: string, percentRaw: unknown, now = new Date()) {
  let percent: number;
  try {
    percent = validatePercent(Number(percentRaw), "Starting battery percentage");
  } catch (e) {
    throw invalid((e as Error).message, { percent: (e as Error).message });
  }
  if (percent === 100) throw invalid("The battery is already full", { percent: "Already at 100%" });
  await db.transaction(async (tx) => {
    const { b, s } = await lockBookingAndSession(tx, bookingId);
    if (b.giverId !== giverId) throw notFound("Booking");
    if (!s || b.status !== "confirmed") throw new AppError("INVALID_STATE", "This booking isn't confirmed");
    if (!s.codeVerifiedAt) throw new AppError("INVALID_STATE", "Verify the driver's code first");
    if (s.status !== "awaiting_start") throw new AppError("INVALID_STATE", "The starting reading has already been recorded");
    await tx.insert(batteryReadings).values({ sessionId: s.id, kind: "start", percent, recordedBy: giverId, recordedAt: now });
    await setSessionStatus(tx, s, "active", giverId, { startedAt: now }, { startPercent: percent });
    const [c] = await tx.select({ title: chargers.title }).from(chargers).where(eq(chargers.id, b.chargerId));
    await notify(tx, b.takerId, "session_started", "Charging started", `${b.reference}: charging started at ${c.title} with your battery at ${percent}%.`, `/bookings/${b.id}`);
    await notify(tx, b.giverId, "session_started", "Charging started", `${b.reference}: session started at ${percent}%.`, `/host/bookings/${b.id}`);
  });
}

/**
 * Charge giver: record the ending battery percentage. The server computes the
 * authoritative bill from the booking's pricing snapshot and issues an invoice.
 */
export async function recordEndReading(giverId: string, bookingId: string, percentRaw: unknown, now = new Date()) {
  let endPercent: number;
  try {
    endPercent = validatePercent(Number(percentRaw), "Ending battery percentage");
  } catch (e) {
    throw invalid((e as Error).message, { percent: (e as Error).message });
  }
  const outcome = await db.transaction(async (tx) => {
    const { b, s } = await lockBookingAndSession(tx, bookingId);
    if (b.giverId !== giverId) throw notFound("Booking");
    if (!s || s.status !== "active") throw new AppError("INVALID_STATE", "This session isn't currently charging");
    const [start] = await tx
      .select()
      .from(batteryReadings)
      .where(and(eq(batteryReadings.sessionId, s.id), eq(batteryReadings.kind, "start")));
    if (!start) throw new AppError("INVALID_STATE", "The starting reading is missing");
    if (endPercent < start.percent)
      throw invalid(`The ending percentage can't be lower than the starting ${start.percent}%`, { percent: `Must be ≥ ${start.percent}%` });

    let bill;
    try {
      bill = calculateBill({
        batteryKwh: b.vehicleBatteryKwh,
        startPercent: start.percent,
        endPercent,
        pricePerKwhPaise: b.pricePerKwhPaise,
        platformFeeBps: b.platformFeeBps,
        platformFeeFixedPaise: b.platformFeeFixedPaise,
        taxBps: b.taxBps,
      });
    } catch (e) {
      if (e instanceof BillingError) throw invalid(e.message);
      throw e;
    }

    await tx.insert(batteryReadings).values({ sessionId: s.id, kind: "end", percent: endPercent, recordedBy: giverId, recordedAt: now });
    const [inv] = await tx
      .insert(invoices)
      .values({
        number: invoiceNumber(),
        bookingId: b.id,
        sessionId: s.id,
        method: bill.method,
        batteryKwh: b.vehicleBatteryKwh,
        startPercent: start.percent,
        endPercent,
        billableWh: bill.billableWh,
        pricePerKwhPaise: b.pricePerKwhPaise,
        energyChargePaise: bill.energyChargePaise,
        platformFeePaise: bill.platformFeePaise,
        taxPaise: bill.taxPaise,
        adjustmentPaise: bill.adjustmentPaise,
        totalPaise: bill.totalPaise,
        giverEarningsPaise: bill.giverEarningsPaise,
        lines: bill.lines,
        status: "open",
        issuedAt: now,
      })
      .returning();
    await audit(tx, { actorId: giverId, entityType: "invoice", entityId: inv.id, action: "issued", toStatus: "open", meta: { totalPaise: inv.totalPaise } });

    if (bill.totalPaise === 0) {
      // Nothing to pay (no charge delivered): close the session without a payment.
      await setSessionStatus(tx, s, "completed", giverId, { endedAt: now, completedAt: now });
      await completePaidSession(tx, { bookingId: b.id, invoiceId: inv.id, actorId: giverId, zeroAmount: true });
      return { zero: true };
    }

    await setSessionStatus(tx, s, "awaiting_payment", giverId, { endedAt: now }, { endPercent });
    const summary = `${formatKwh(bill.billableWh)} estimated · ${formatPaise(bill.totalPaise)}`;
    await notify(tx, b.takerId, "session_ended", "Charging finished — please pay", `${b.reference}: ${start.percent}% → ${endPercent}%. ${summary}.`, `/bookings/${b.id}/pay`);
    await notify(tx, b.giverId, "session_ended", "Session ended", `${b.reference}: bill of ${formatPaise(bill.totalPaise)} sent to the driver.`, `/host/bookings/${b.id}`);
    return { zero: false };
  });
  return outcome;
}
