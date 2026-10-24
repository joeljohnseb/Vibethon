import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, type DB } from "@/lib/db";
import { bookingSlotLocks, bookings, chargingSessions } from "@/lib/db/schema";
import { cancelBooking, createBooking, decideBooking, getBookingForUser, runBookingMaintenance } from "@/lib/services/bookings";
import { freshDb, makeCharger, makeUser, makeVehicle, tomorrowAt } from "./helpers";

let db: DB;
beforeEach(async () => { db = await freshDb(); });
afterEach(async () => { await closeDb(); });

async function setup(opts: { mode?: "approval" | "instant" } = {}) {
  const giver = await makeUser(db, { verified: true, name: "Host Person" });
  const charger = await makeCharger(db, giver.id, { bookingMode: opts.mode ?? "approval" });
  const t1 = await makeUser(db);
  const t2 = await makeUser(db);
  const v1 = await makeVehicle(db, t1.id);
  const v2 = await makeVehicle(db, t2.id);
  return { giver, charger, t1, t2, v1, v2 };
}

describe("booking requests", () => {
  it("creates a pending request with a pricing snapshot and reveals the address only after approval", async () => {
    const { giver, charger, t1, v1 } = await setup();
    const b = await createBooking(t1.id, { chargerId: charger.id, vehicleId: v1.id, startAt: tomorrowAt(10), slotCount: 2 });
    expect(b.status).toBe("pending");
    expect(b.reference).toMatch(/^EBR-[0-9A-Z]{6}$/);
    expect(b.pricePerKwhPaise).toBe(1200);
    expect(b.vehicleBatteryKwh).toBe(60);

    let view = await getBookingForUser(t1.id, b.id);
    expect(view.charger.private).toBeNull();

    await decideBooking(giver.id, b.id, "approve");
    view = await getBookingForUser(t1.id, b.id);
    expect(view.booking.status).toBe("confirmed");
    expect(view.charger.private?.addressLine).toBe("12 Secret Lane");
    expect(view.session?.status).toBe("awaiting_start");
    const locks = await db.select().from(bookingSlotLocks).where(eq(bookingSlotLocks.bookingId, b.id));
    expect(locks).toHaveLength(2);
  });

  it("does not let other users see a booking", async () => {
    const { charger, t1, t2, v1 } = await setup();
    const b = await createBooking(t1.id, { chargerId: charger.id, vehicleId: v1.id, startAt: tomorrowAt(10), slotCount: 1 });
    await expect(getBookingForUser(t2.id, b.id)).rejects.toThrow(/not found/i);
    await expect(cancelBooking(t2.id, b.id, "")).rejects.toThrow();
    await expect(decideBooking(t2.id, b.id, "approve")).rejects.toThrow();
  });

  it("rejects incompatible vehicles, own chargers, unpublished listings and past times", async () => {
    const { giver, charger, t1 } = await setup();
    const chademoOnly = await makeVehicle(db, t1.id, { connectors: ["chademo"] });
    await expect(createBooking(t1.id, { chargerId: charger.id, vehicleId: chademoOnly.id, startAt: tomorrowAt(10), slotCount: 1 })).rejects.toThrow(/compatible/);

    const gv = await makeVehicle(db, giver.id);
    await expect(createBooking(giver.id, { chargerId: charger.id, vehicleId: gv.id, startAt: tomorrowAt(10), slotCount: 1 })).rejects.toThrow(/own charger/);

    const v = await makeVehicle(db, t1.id);
    await expect(createBooking(t1.id, { chargerId: charger.id, vehicleId: v.id, startAt: new Date(Date.now() - 3600_000), slotCount: 1 })).rejects.toThrow();

    const draft = await makeCharger(db, giver.id, { status: "paused" });
    await expect(createBooking(t1.id, { chargerId: draft.id, vehicleId: v.id, startAt: tomorrowAt(10), slotCount: 1 })).rejects.toThrow(/isn't accepting/);
  });

  it("rejects times outside the host's availability", async () => {
    const giver = await makeUser(db, { verified: true });
    const charger = await makeCharger(db, giver.id);
    const { availabilityRules } = await import("@/lib/db/schema");
    await db.delete(availabilityRules).where(eq(availabilityRules.chargerId, charger.id));
    await db.insert(availabilityRules).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ chargerId: charger.id, weekday, startMinute: 9 * 60, endMinute: 12 * 60 })));
    const t = await makeUser(db);
    const v = await makeVehicle(db, t.id);
    await expect(createBooking(t.id, { chargerId: charger.id, vehicleId: v.id, startAt: tomorrowAt(14), slotCount: 1 })).rejects.toThrow(/no longer available/);
    await expect(createBooking(t.id, { chargerId: charger.id, vehicleId: v.id, startAt: tomorrowAt(11), slotCount: 2 })).rejects.toThrow(/no longer available/);
    await expect(createBooking(t.id, { chargerId: charger.id, vehicleId: v.id, startAt: tomorrowAt(11), slotCount: 1 })).resolves.toBeTruthy();
  });

  it("is idempotent per client key", async () => {
    const { charger, t1, v1 } = await setup();
    const input = { chargerId: charger.id, vehicleId: v1.id, startAt: tomorrowAt(10), slotCount: 1, idempotencyKey: "abc-123" };
    const a = await createBooking(t1.id, input);
    const b = await createBooking(t1.id, input);
    expect(b.id).toBe(a.id);
    expect(await db.select().from(bookings)).toHaveLength(1);
  });
});

describe("double-booking prevention", () => {
  it("approving one request auto-declines overlapping requests and blocks the slot", async () => {
    const { giver, charger, t1, t2, v1, v2 } = await setup();
    const a = await createBooking(t1.id, { chargerId: charger.id, vehicleId: v1.id, startAt: tomorrowAt(10), slotCount: 2 });
    const b = await createBooking(t2.id, { chargerId: charger.id, vehicleId: v2.id, startAt: tomorrowAt(11), slotCount: 1 });
    await decideBooking(giver.id, a.id, "approve");
    const [bAfter] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(bAfter.status).toBe("rejected");
    await expect(createBooking(t2.id, { chargerId: charger.id, vehicleId: v2.id, startAt: tomorrowAt(11), slotCount: 1 })).rejects.toThrow(/no longer available/);
    // Adjacent slot is still fine.
    await expect(createBooking(t2.id, { chargerId: charger.id, vehicleId: v2.id, startAt: tomorrowAt(12), slotCount: 1 })).resolves.toBeTruthy();
  });

  it("concurrent instant bookings for the same slot: exactly one succeeds", async () => {
    const giver = await makeUser(db, { verified: true });
    const charger = await makeCharger(db, giver.id, { bookingMode: "instant" });
    const takers = await Promise.all(Array.from({ length: 5 }, () => makeUser(db)));
    const vehicles = await Promise.all(takers.map((t) => makeVehicle(db, t.id)));
    const results = await Promise.allSettled(
      takers.map((t, i) => createBooking(t.id, { chargerId: charger.id, vehicleId: vehicles[i].id, startAt: tomorrowAt(9), slotCount: 1 })),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const confirmed = (await db.select().from(bookings)).filter((b) => b.status === "confirmed");
    expect(confirmed).toHaveLength(1);
    expect(await db.select().from(bookingSlotLocks)).toHaveLength(1);
  });

  it("the slot-lock primary key rejects a second reservation even if app checks are bypassed", async () => {
    const { giver, charger, t1, v1 } = await setup();
    const a = await createBooking(t1.id, { chargerId: charger.id, vehicleId: v1.id, startAt: tomorrowAt(10), slotCount: 1 });
    await decideBooking(giver.id, a.id, "approve");
    await expect(db.insert(bookingSlotLocks).values({ chargerId: charger.id, slotStart: tomorrowAt(10), bookingId: a.id })).rejects.toThrow();
  });

  it("cancelling a confirmed booking frees its slots", async () => {
    const { giver, charger, t1, t2, v1, v2 } = await setup();
    const a = await createBooking(t1.id, { chargerId: charger.id, vehicleId: v1.id, startAt: tomorrowAt(10), slotCount: 1 });
    await decideBooking(giver.id, a.id, "approve");
    await cancelBooking(t1.id, a.id, "Plans changed");
    expect(await db.select().from(bookingSlotLocks)).toHaveLength(0);
    await expect(createBooking(t2.id, { chargerId: charger.id, vehicleId: v2.id, startAt: tomorrowAt(10), slotCount: 1 })).resolves.toBeTruthy();
  });

  it("flags late cancellations according to the policy", async () => {
    const { giver, charger, t1, v1 } = await setup();
    const IST = 330 * 60_000;
    const start = new Date(Math.ceil((Date.now() + 2 * 3600_000 + IST) / 3600_000) * 3600_000 - IST); // next IST hour, within 24 h
    await db.update((await import("@/lib/db/schema")).chargers).set({ cancellationPolicy: "strict" }).where(eq((await import("@/lib/db/schema")).chargers.id, charger.id));
    const a = await createBooking(t1.id, { chargerId: charger.id, vehicleId: v1.id, startAt: start, slotCount: 1 });
    await decideBooking(giver.id, a.id, "approve");
    await cancelBooking(t1.id, a.id, "");
    const [after] = await db.select().from(bookings).where(eq(bookings.id, a.id));
    expect(after.status).toBe("cancelled");
    expect(after.lateCancellation).toBe(true);
  });

  it("expires unanswered requests once their start time passes", async () => {
    const { charger, t1, v1 } = await setup();
    const a = await createBooking(t1.id, { chargerId: charger.id, vehicleId: v1.id, startAt: tomorrowAt(10), slotCount: 1 });
    await runBookingMaintenance(new Date(tomorrowAt(10).getTime() + 60_000));
    const [after] = await db.select().from(bookings).where(eq(bookings.id, a.id));
    expect(after.status).toBe("expired");
    expect(await db.select().from(chargingSessions)).toHaveLength(0);
  });
});
