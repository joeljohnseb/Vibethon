import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TZ = "Asia/Kolkata";
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type Rule = { weekday: number; startMinute: number; endMinute: number };
export type Range = { startAt: Date; endAt: Date };
export type Slot = { start: Date; end: Date; available: boolean; reason?: "past" | "booked" | "blocked" };

export const pad = (n: number) => String(n).padStart(2, "0");
export const minutesToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export function hhmmToMinutes(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return NaN;
  return h * 60 + min;
}

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** The calendar date (YYYY-MM-DD) of `instant` in `tz`. */
export const localDate = (instant: Date, tz = DEFAULT_TZ) => formatInTimeZone(instant, tz, "yyyy-MM-dd");

/** Weekday (0 = Sunday) of a YYYY-MM-DD date string. */
export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Convert a local wall-clock time on `date` in `tz` to a UTC instant. */
export function zonedInstant(date: string, minuteOfDay: number, tz = DEFAULT_TZ): Date {
  if (minuteOfDay === 1440) return zonedInstant(addDays(date, 1), 0, tz);
  return fromZonedTime(`${date}T${minutesToHHMM(minuteOfDay)}:00`, tz);
}

const overlaps = (a: Range, b: Range) => a.startAt < b.endAt && b.startAt < a.endAt;

/**
 * All bookable slots for a local `date`, derived from weekly rules, minus
 * one-off blocks, already-reserved slots and anything that has already started.
 */
export function generateSlots(args: {
  date: string;
  tz?: string;
  slotMinutes: number;
  rules: Rule[];
  blocks?: Range[];
  lockedStarts?: Date[];
  now?: Date;
}): Slot[] {
  const { date, slotMinutes, rules } = args;
  const tz = args.tz ?? DEFAULT_TZ;
  const now = args.now ?? new Date();
  const locked = new Set((args.lockedStarts ?? []).map((d) => d.getTime()));
  const wd = weekdayOf(date);
  const seen = new Set<number>();
  const slots: Slot[] = [];

  for (const rule of rules.filter((r) => r.weekday === wd).sort((a, b) => a.startMinute - b.startMinute)) {
    // Align to the slot grid so locks always line up.
    const first = Math.ceil(rule.startMinute / slotMinutes) * slotMinutes;
    for (let m = first; m + slotMinutes <= rule.endMinute; m += slotMinutes) {
      const start = zonedInstant(date, m, tz);
      const end = zonedInstant(date, m + slotMinutes, tz);
      if (seen.has(start.getTime())) continue;
      seen.add(start.getTime());
      let reason: Slot["reason"];
      if (start <= now) reason = "past";
      else if (locked.has(start.getTime())) reason = "booked";
      else if ((args.blocks ?? []).some((b) => overlaps(b, { startAt: start, endAt: end }))) reason = "blocked";
      slots.push({ start, end, available: !reason, reason });
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Split [startAt, endAt) into slot start instants. Throws if not grid-aligned. */
export function slotStartsFor(startAt: Date, endAt: Date, slotMinutes: number): Date[] {
  const ms = slotMinutes * 60_000;
  const span = endAt.getTime() - startAt.getTime();
  if (span <= 0 || span % ms !== 0) throw new Error("Booking range must be a whole number of slots");
  const out: Date[] = [];
  for (let t = startAt.getTime(); t < endAt.getTime(); t += ms) out.push(new Date(t));
  return out;
}

/** True when every slot in [startAt, endAt) is present and available. */
export function rangeIsAvailable(slots: Slot[], startAt: Date, endAt: Date, slotMinutes: number) {
  const byStart = new Map(slots.map((s) => [s.start.getTime(), s]));
  return slotStartsFor(startAt, endAt, slotMinutes).every((s) => byStart.get(s.getTime())?.available === true);
}

export function fmtDateTime(d: Date, tz = DEFAULT_TZ) {
  return formatInTimeZone(d, tz, "EEE d MMM yyyy, h:mm a");
}
export function fmtDate(d: Date, tz = DEFAULT_TZ) {
  return formatInTimeZone(d, tz, "EEE d MMM yyyy");
}
export function fmtTime(d: Date, tz = DEFAULT_TZ) {
  return formatInTimeZone(d, tz, "h:mm a");
}
export function fmtRange(a: Date, b: Date, tz = DEFAULT_TZ) {
  return `${fmtDate(a, tz)} · ${fmtTime(a, tz)} – ${fmtTime(b, tz)}`;
}
export function tzAbbrev(tz = DEFAULT_TZ) {
  return tz === "Asia/Kolkata" ? "IST" : formatInTimeZone(new Date(), tz, "zzz");
}
