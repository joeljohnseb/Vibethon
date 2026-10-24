import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, type DB } from "@/lib/db";
import { chargingSessions, confirmationCodes } from "@/lib/db/schema";
import { createBooking, decideBooking } from "@/lib/services/bookings";
import { issueStartCode, recordEndReading, recordStartReading, verifyStartCode } from "@/lib/services/charging";
import { freshDb, makeCharger, makeUser, makeVehicle, tomorrowAt } from "./helpers";

let db: DB;
beforeEach(async () => { db = await freshDb(); });
afterEach(async () => { await closeDb(); });

async function confirmedBooking(hour = 10) {
  const giver = await makeUser(db, { verified: true });
  const charger = await makeCharger(db, giver.id);
  const taker = await makeUser(db);
  const v = await makeVehicle(db, taker.id);
  const b = await createBooking(taker.id, { chargerId: charger.id, vehicleId: v.id, startAt: tomorrowAt(hour), slotCount: 2 });
  await decideBooking(giver.id, b.id, "approve");
  const atStart = new Date(b.startAt.getTime() - 5 * 60_000);
  return { giver, taker, charger, b, atStart };
}

const session = async (bookingId: string) => (await db.select().from(chargingSessions).where(eq(chargingSessions.bookingId, bookingId)))[0];

describe("shared-code confirmation", () => {
  it("valid code starts only its own booking; codes are single-use and hashed", async () => {
    const { giver, taker, b, atStart } = await confirmedBooking();
    const { code } = await issueStartCode(taker.id, b.id, atStart);
    expect(code).toMatch(/^\d{6}$/);
    const [row] = await db.select().from(confirmationCodes).where(eq(confirmationCodes.bookingId, b.id));
    expect(row.codeHash).not.toContain(code);

    await expect(recordStartReading(giver.id, b.id, 30)).rejects.toThrow(/Verify the driver's code first/);
    await verifyStartCode(giver.id, b.id, code, atStart);
    expect((await session(b.id)).codeVerifiedAt).toBeTruthy();
    const [used] = await db.select().from(confirmationCodes).where(eq(confirmationCodes.bookingId, b.id));
    expect(used.usedAt).toBeTruthy();

    await recordStartReading(giver.id, b.id, 30);
    expect((await session(b.id)).status).toBe("active");
    // Code can't be reused / reissued after start.
    await expect(issueStartCode(taker.id, b.id, atStart)).rejects.toThrow();
  });

  it("a code for one booking cannot start another booking", async () => {
    const one = await confirmedBooking(10);
    const twoTaker = await makeUser(db);
    const v = await makeVehicle(db, twoTaker.id);
    const two = await createBooking(twoTaker.id, { chargerId: one.charger.id, vehicleId: v.id, startAt: tomorrowAt(12), slotCount: 1 });
    await decideBooking(one.giver.id, two.id, "approve");
    const { code } = await issueStartCode(one.taker.id, one.b.id, one.atStart);
    await issueStartCode(twoTaker.id, two.id, new Date(two.startAt.getTime() - 60_000));
    await expect(verifyStartCode(one.giver.id, two.id, code, new Date(two.startAt.getTime() - 60_000))).rejects.toThrow(/Incorrect code/);
    expect((await session(two.id)).codeVerifiedAt).toBeNull();
  });

  it("locks out after 5 wrong attempts, even if the right code is then entered", async () => {
    const { giver, taker, b, atStart } = await confirmedBooking();
    const { code } = await issueStartCode(taker.id, b.id, atStart);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) await expect(verifyStartCode(giver.id, b.id, wrong, atStart)).rejects.toThrow(/attempt\(s\) left/);
    await expect(verifyStartCode(giver.id, b.id, wrong, atStart)).rejects.toThrow(/Too many incorrect attempts/);
    await expect(verifyStartCode(giver.id, b.id, code, atStart)).rejects.toThrow(/no active code/i);
    // A fresh code works.
    const fresh = await issueStartCode(taker.id, b.id, atStart);
    await verifyStartCode(giver.id, b.id, fresh.code, atStart);
  });

  it("expired codes are rejected and re-issuing revokes the previous code", async () => {
    const { giver, taker, b, atStart } = await confirmedBooking();
    const first = await issueStartCode(taker.id, b.id, atStart);
    const later = new Date(atStart.getTime() + 11 * 60_000);
    await expect(verifyStartCode(giver.id, b.id, first.code, later)).rejects.toThrow(/no active code/i);
    const second = await issueStartCode(taker.id, b.id, atStart);
    await expect(verifyStartCode(giver.id, b.id, first.code, atStart)).rejects.toThrow(/Incorrect/);
    await verifyStartCode(giver.id, b.id, second.code, atStart);
  });

  it("only the taker can issue and only the host can verify; outside the window is refused", async () => {
    const { giver, taker, b, atStart } = await confirmedBooking();
    await expect(issueStartCode(giver.id, b.id, atStart)).rejects.toThrow();
    await expect(issueStartCode(taker.id, b.id, new Date(b.startAt.getTime() - 3 * 3600_000))).rejects.toThrow(/becomes available/);
    const { code } = await issueStartCode(taker.id, b.id, atStart);
    await expect(verifyStartCode(taker.id, b.id, code, atStart)).rejects.toThrow();
  });
});

describe("battery readings", () => {
  it("validates readings and computes the bill on the server", async () => {
    const { giver, taker, b, atStart } = await confirmedBooking();
    const { code } = await issueStartCode(taker.id, b.id, atStart);
    await verifyStartCode(giver.id, b.id, code, atStart);
    await expect(recordStartReading(giver.id, b.id, 101)).rejects.toThrow();
    await expect(recordStartReading(giver.id, b.id, -2)).rejects.toThrow();
    await expect(recordStartReading(taker.id, b.id, 30)).rejects.toThrow();
    await recordStartReading(giver.id, b.id, 30);
    await expect(recordStartReading(giver.id, b.id, 35)).rejects.toThrow(/already been recorded/);
    await expect(recordEndReading(giver.id, b.id, 20)).rejects.toThrow(/can't be lower/);
    await expect(recordEndReading(giver.id, b.id, 150)).rejects.toThrow();
    await recordEndReading(giver.id, b.id, 70);
    const s = await session(b.id);
    expect(s.status).toBe("awaiting_payment");
    const { invoices } = await import("@/lib/db/schema");
    const [inv] = await db.select().from(invoices).where(eq(invoices.bookingId, b.id));
    expect(inv.billableWh).toBe(24000);
    expect(inv.totalPaise).toBe(28800);
    expect(inv.status).toBe("open");
  });

  it("uses the pricing snapshot, not the current listing price", async () => {
    const { giver, taker, b, atStart, charger } = await confirmedBooking();
    const { chargers, invoices } = await import("@/lib/db/schema");
    await db.update(chargers).set({ pricePerKwhPaise: 9900 }).where(eq(chargers.id, charger.id));
    const { code } = await issueStartCode(taker.id, b.id, atStart);
    await verifyStartCode(giver.id, b.id, code, atStart);
    await recordStartReading(giver.id, b.id, 30);
    await recordEndReading(giver.id, b.id, 70);
    const [inv] = await db.select().from(invoices).where(eq(invoices.bookingId, b.id));
    expect(inv.pricePerKwhPaise).toBe(1200);
    expect(inv.totalPaise).toBe(28800);
  });
});
