import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, type DB } from "@/lib/db";
import { bookings, chargingSessions, earnings, invoices, payments, reviews, webhookEvents } from "@/lib/db/schema";
import { createBooking, decideBooking } from "@/lib/services/bookings";
import { issueStartCode, recordEndReading, recordStartReading, verifyStartCode } from "@/lib/services/charging";
import { handleWebhook, simulateSandboxPayment, startCheckout } from "@/lib/services/payments";
import { createReview } from "@/lib/services/reviews";
import { buildSandboxEvent } from "@/lib/payments/sandbox";
import { freshDb, makeCharger, makeUser, makeVehicle, tomorrowAt } from "./helpers";

let db: DB;
beforeEach(async () => { db = await freshDb(); });
afterEach(async () => { await closeDb(); });

async function awaitingPayment() {
  const giver = await makeUser(db, { verified: true });
  const charger = await makeCharger(db, giver.id);
  const taker = await makeUser(db);
  const v = await makeVehicle(db, taker.id);
  const b = await createBooking(taker.id, { chargerId: charger.id, vehicleId: v.id, startAt: tomorrowAt(10), slotCount: 2 });
  await decideBooking(giver.id, b.id, "approve");
  const at = new Date(b.startAt.getTime() - 60_000);
  const { code } = await issueStartCode(taker.id, b.id, at);
  await verifyStartCode(giver.id, b.id, code, at);
  await recordStartReading(giver.id, b.id, 30);
  await recordEndReading(giver.id, b.id, 70);
  return { giver, taker, b };
}
const state = async (bookingId: string) => {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  const [s] = await db.select().from(chargingSessions).where(eq(chargingSessions.bookingId, bookingId));
  const [inv] = await db.select().from(invoices).where(eq(invoices.bookingId, bookingId));
  return { booking: b.status, session: s.status, invoice: inv.status };
};

describe("payment state transitions", () => {
  it("is not completed until a verified payment arrives", async () => {
    const { taker, b } = await awaitingPayment();
    const co = await startCheckout(taker.id, b.id);
    expect(co.amountPaise).toBe(28800);
    expect(await state(b.id)).toEqual({ booking: "confirmed", session: "awaiting_payment", invoice: "open" });
    // Starting checkout twice reuses the same order (no duplicate charge possible).
    expect((await startCheckout(taker.id, b.id)).orderId).toBe(co.orderId);
    expect(await db.select().from(payments)).toHaveLength(1);
  });

  it("failed payment → payment_failed, retry → completed with one earning", async () => {
    const { giver, taker, b } = await awaitingPayment();
    const co = await startCheckout(taker.id, b.id);
    await simulateSandboxPayment(taker.id, co.orderId, "failure");
    expect(await state(b.id)).toEqual({ booking: "confirmed", session: "payment_failed", invoice: "open" });
    await expect(createReview(taker.id, b.id, 5, "great")).rejects.toThrow(/completed and paid/);

    await simulateSandboxPayment(taker.id, co.orderId, "pending");
    expect((await state(b.id)).session).toBe("payment_pending");

    await simulateSandboxPayment(taker.id, co.orderId, "success");
    expect(await state(b.id)).toEqual({ booking: "completed", session: "completed", invoice: "paid" });
    const e = await db.select().from(earnings).where(eq(earnings.giverId, giver.id));
    expect(e).toHaveLength(1);
    expect(e[0].netPaise).toBe(28800);
  });

  it("duplicate webhooks are processed once", async () => {
    const { taker, b } = await awaitingPayment();
    const co = await startCheckout(taker.id, b.id);
    const evt = buildSandboxEvent(co.orderId, co.amountPaise, "success");
    expect(await handleWebhook("sandbox", evt.body, evt.signature, evt.eventId)).toBe("processed");
    expect(await handleWebhook("sandbox", evt.body, evt.signature, evt.eventId)).toBe("duplicate");
    // A different event id for the same capture is also harmless.
    const again = buildSandboxEvent(co.orderId, co.amountPaise, "success");
    await handleWebhook("sandbox", again.body, again.signature, again.eventId);
    expect(await db.select().from(earnings)).toHaveLength(1);
    expect((await db.select().from(payments))[0].status).toBe("captured");
    // A late failure after success does not undo it.
    const late = buildSandboxEvent(co.orderId, co.amountPaise, "failure");
    await handleWebhook("sandbox", late.body, late.signature, late.eventId);
    expect(await state(b.id)).toEqual({ booking: "completed", session: "completed", invoice: "paid" });
  });

  it("rejects forged signatures and ignores amount mismatches", async () => {
    const { taker, b } = await awaitingPayment();
    const co = await startCheckout(taker.id, b.id);
    const evt = buildSandboxEvent(co.orderId, co.amountPaise, "success");
    await expect(handleWebhook("sandbox", evt.body, "deadbeef".repeat(8), "x1")).rejects.toThrow(/signature/);
    const tampered = evt.body.replace(String(co.amountPaise), "100");
    await expect(handleWebhook("sandbox", tampered, evt.signature, "x2")).rejects.toThrow(/signature/);
    const cheap = buildSandboxEvent(co.orderId, 100, "success");
    expect(await handleWebhook("sandbox", cheap.body, cheap.signature, cheap.eventId)).toBe("ignored");
    expect((await state(b.id)).session).toBe("awaiting_payment");
    const [evtRow] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, cheap.eventId));
    expect(evtRow.error).toMatch(/Amount mismatch/);
  });

  it("other users cannot pay or simulate payment for someone else's booking", async () => {
    const { taker, b } = await awaitingPayment();
    const stranger = await makeUser(db);
    await expect(startCheckout(stranger.id, b.id)).rejects.toThrow();
    const co = await startCheckout(taker.id, b.id);
    await expect(simulateSandboxPayment(stranger.id, co.orderId, "success")).rejects.toThrow();
  });
});

describe("reviews", () => {
  it("each participant can review once, only after a paid completed session", async () => {
    const { giver, taker, b } = await awaitingPayment();
    await expect(createReview(taker.id, b.id, 5, "")).rejects.toThrow();
    const co = await startCheckout(taker.id, b.id);
    await simulateSandboxPayment(taker.id, co.orderId, "success");
    await createReview(taker.id, b.id, 5, "Easy to find, friendly host");
    await expect(createReview(taker.id, b.id, 4, "again")).rejects.toThrow(/already reviewed/);
    await createReview(giver.id, b.id, 4, "On time");
    const stranger = await makeUser(db);
    await expect(createReview(stranger.id, b.id, 1, "spam")).rejects.toThrow();
    await expect(createReview(giver.id, b.id, 6, "")).rejects.toThrow();
    const rows = await db.select().from(reviews);
    expect(rows.map((r) => r.direction).sort()).toEqual(["giver_to_taker", "taker_to_giver"]);
  });
});
