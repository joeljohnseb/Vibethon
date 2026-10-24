import { describe, expect, it } from "vitest";
import { assertTransition, bookingTransitions, canTransition, paymentTransitions, sessionTransitions } from "@/lib/state";
import { generateSlots, rangeIsAvailable, zonedInstant } from "@/lib/time";

describe("state machines", () => {
  it("booking cannot skip from pending to completed", () => {
    expect(canTransition(bookingTransitions, "pending", "completed")).toBe(false);
    expect(() => assertTransition("booking", bookingTransitions, "pending", "completed")).toThrow();
    expect(canTransition(bookingTransitions, "pending", "confirmed")).toBe(true);
    expect(canTransition(bookingTransitions, "cancelled", "confirmed")).toBe(false);
  });
  it("session cannot complete before charging ends", () => {
    expect(canTransition(sessionTransitions, "awaiting_start", "completed")).toBe(false);
    expect(canTransition(sessionTransitions, "awaiting_start", "awaiting_payment")).toBe(false);
    expect(canTransition(sessionTransitions, "payment_failed", "completed")).toBe(true);
    expect(canTransition(sessionTransitions, "completed", "payment_failed")).toBe(false);
  });
  it("captured payments are terminal except refunds", () => {
    expect(canTransition(paymentTransitions, "captured", "failed")).toBe(false);
    expect(canTransition(paymentTransitions, "failed", "captured")).toBe(true);
  });
});

describe("slot generation", () => {
  const rules = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }]; // Monday 09:00–12:00 IST
  const date = "2030-01-07"; // a Monday
  it("creates aligned slots in the charger's timezone", () => {
    const slots = generateSlots({ date, slotMinutes: 60, rules, now: new Date("2029-01-01") });
    expect(slots).toHaveLength(3);
    expect(slots[0].start.toISOString()).toBe("2030-01-07T03:30:00.000Z"); // 09:00 IST
  });
  it("marks locked, blocked and past slots unavailable", () => {
    const s10 = zonedInstant(date, 600);
    const slots = generateSlots({
      date, slotMinutes: 60, rules, lockedStarts: [s10],
      blocks: [{ startAt: zonedInstant(date, 660), endAt: zonedInstant(date, 720) }],
      now: new Date("2029-01-01"),
    });
    expect(slots.map((s) => s.reason ?? "ok")).toEqual(["ok", "booked", "blocked"]);
    expect(rangeIsAvailable(slots, slots[0].start, slots[1].end, 60)).toBe(false);
    expect(rangeIsAvailable(slots, slots[0].start, slots[0].end, 60)).toBe(true);
  });
  it("returns nothing on days without rules", () => {
    expect(generateSlots({ date: "2030-01-08", slotMinutes: 60, rules })).toHaveLength(0);
  });
});
