import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db, type Executor } from "@/lib/db";
import { availabilityBlocks, availabilityRules, bookingSlotLocks } from "@/lib/db/schema";
import { addDays, generateSlots, localDate, zonedInstant, type Range, type Rule, type Slot } from "@/lib/time";

export type AvailabilityContext = {
  rules: Map<string, Rule[]>;
  blocks: Map<string, Range[]>;
  locks: Map<string, Date[]>;
};

/** Loads everything needed to compute slots for many chargers over a date range. */
export async function loadAvailability(
  chargerIds: string[],
  fromDate: string,
  toDate: string,
  tz: string,
  ex: Executor = db,
): Promise<AvailabilityContext> {
  const ctx: AvailabilityContext = { rules: new Map(), blocks: new Map(), locks: new Map() };
  if (!chargerIds.length) return ctx;
  const from = zonedInstant(fromDate, 0, tz);
  const to = zonedInstant(addDays(toDate, 1), 0, tz);
  const [rules, blocks, locks] = await Promise.all([
    ex.select().from(availabilityRules).where(inArray(availabilityRules.chargerId, chargerIds)),
    ex
      .select()
      .from(availabilityBlocks)
      .where(and(inArray(availabilityBlocks.chargerId, chargerIds), lt(availabilityBlocks.startAt, to), gte(availabilityBlocks.endAt, from))),
    ex
      .select()
      .from(bookingSlotLocks)
      .where(and(inArray(bookingSlotLocks.chargerId, chargerIds), gte(bookingSlotLocks.slotStart, from), lt(bookingSlotLocks.slotStart, to))),
  ]);
  for (const r of rules) (ctx.rules.get(r.chargerId) ?? ctx.rules.set(r.chargerId, []).get(r.chargerId)!).push(r);
  for (const b of blocks) (ctx.blocks.get(b.chargerId) ?? ctx.blocks.set(b.chargerId, []).get(b.chargerId)!).push(b);
  for (const l of locks) (ctx.locks.get(l.chargerId) ?? ctx.locks.set(l.chargerId, []).get(l.chargerId)!).push(l.slotStart);
  return ctx;
}

export function slotsFor(
  charger: { id: string; slotMinutes: number; timezone: string },
  date: string,
  ctx: AvailabilityContext,
  now = new Date(),
): Slot[] {
  return generateSlots({
    date,
    tz: charger.timezone,
    slotMinutes: charger.slotMinutes,
    rules: ctx.rules.get(charger.id) ?? [],
    blocks: ctx.blocks.get(charger.id) ?? [],
    lockedStarts: ctx.locks.get(charger.id) ?? [],
    now,
  });
}

/** Slots for a single charger on one local date. */
export async function chargerSlots(
  charger: { id: string; slotMinutes: number; timezone: string },
  date: string,
  ex: Executor = db,
  now = new Date(),
) {
  const ctx = await loadAvailability([charger.id], date, date, charger.timezone, ex);
  return slotsFor(charger, date, ctx, now);
}

/** First available slot within the next `days` days. */
export function nextAvailable(
  charger: { id: string; slotMinutes: number; timezone: string },
  ctx: AvailabilityContext,
  days = 7,
  now = new Date(),
): Slot | null {
  const today = localDate(now, charger.timezone);
  for (let i = 0; i < days; i++) {
    const s = slotsFor(charger, addDays(today, i), ctx, now).find((x) => x.available);
    if (s) return s;
  }
  return null;
}

export async function lockedSlotsForBooking(bookingId: string, ex: Executor = db) {
  return ex.select().from(bookingSlotLocks).where(eq(bookingSlotLocks.bookingId, bookingId));
}
