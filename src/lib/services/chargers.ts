import { and, asc, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  availabilityBlocks,
  availabilityRules,
  bookings,
  chargerPhotos,
  chargers,
  users,
} from "@/lib/db/schema";
import { CONNECTOR_IDS } from "@/lib/constants";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { audit } from "./notify";
import { deleteStoredFile } from "@/lib/storage";

const text = (max: number) => z.string().trim().max(max);

export const chargerSchema = z.object({
  title: z.string().trim().min(4, "Give your charger a short title").max(80),
  description: text(1500).default(""),
  addressLine: z.string().trim().min(5, "Enter the street address").max(200),
  locality: z.string().trim().min(2, "Enter the locality / neighbourhood").max(80),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Enter the state").max(60),
  postalCode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit PIN code"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  connectors: z.array(z.enum(CONNECTOR_IDS)).min(1, "Select at least one connector"),
  powerKw: z.coerce.number().gt(0, "Enter the charger's power").max(400),
  pricePerKwhPaise: z.coerce.number().int().min(100, "Minimum price is ₹1/kWh").max(100000, "Maximum price is ₹1000/kWh"),
  parkingInfo: text(800).default(""),
  accessInstructions: text(1500).default(""),
  safetyInfo: text(1500).default(""),
  amenities: z.array(z.string().max(40)).max(12).default([]),
  bookingMode: z.enum(["approval", "instant"]).default("approval"),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict"]).default("flexible"),
  slotMinutes: z.coerce.number().refine((n) => n === 30 || n === 60, "Slot length must be 30 or 60 minutes").default(60),
  photoIds: z.array(z.string().uuid()).max(8, "Up to 8 photos").default([]),
});
export type ChargerInput = z.input<typeof chargerSchema>;

export const rulesSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      startMinute: z.number().int().min(0).max(1439),
      endMinute: z.number().int().min(1).max(1440),
    }),
  )
  .max(50)
  .superRefine((rules, ctx) => {
    for (const r of rules) if (r.startMinute >= r.endMinute) ctx.addIssue({ code: "custom", message: "Each window must end after it starts" });
    for (let d = 0; d <= 6; d++) {
      const day = rules.filter((r) => r.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < day.length; i++)
        if (day[i].startMinute < day[i - 1].endMinute) ctx.addIssue({ code: "custom", message: "Availability windows on the same day overlap" });
    }
  });

function parseCharger(input: unknown) {
  const r = chargerSchema.safeParse(input);
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const i of r.error.issues) fe[String(i.path[0])] ??= i.message;
    throw invalid("Please fix the highlighted fields", fe);
  }
  return r.data;
}

async function ownCharger(ownerId: string, chargerId: string) {
  const [c] = await db.select().from(chargers).where(eq(chargers.id, chargerId));
  if (!c || c.status === "removed") throw notFound("Charger");
  if (c.ownerId !== ownerId) throw forbidden();
  return c;
}

async function attachPhotos(ownerId: string, chargerId: string, photoIds: string[]) {
  await db.transaction(async (tx) => {
    const current = await tx.select().from(chargerPhotos).where(eq(chargerPhotos.chargerId, chargerId));
    const toRemove = current.filter((p) => !photoIds.includes(p.id));
    if (toRemove.length) {
      await tx.delete(chargerPhotos).where(inArray(chargerPhotos.id, toRemove.map((p) => p.id)));
      for (const p of toRemove) void deleteStoredFile(p.storageKey);
    }
    for (const [i, id] of photoIds.entries()) {
      // Only photos this owner uploaded, that are unattached or already on this charger.
      await tx
        .update(chargerPhotos)
        .set({ chargerId, sortOrder: i })
        .where(
          and(
            eq(chargerPhotos.id, id),
            eq(chargerPhotos.uploadedBy, ownerId),
            sql`(${chargerPhotos.chargerId} is null or ${chargerPhotos.chargerId} = ${chargerId})`,
          ),
        );
    }
  });
}

export async function createCharger(ownerId: string, input: unknown) {
  const v = parseCharger(input);
  const { photoIds, ...data } = v;
  const [row] = await db.insert(chargers).values({ ...data, ownerId, status: "draft" }).returning();
  await attachPhotos(ownerId, row.id, photoIds);
  await audit(db, { actorId: ownerId, entityType: "charger", entityId: row.id, action: "created", toStatus: "draft" });
  return row;
}

export async function updateCharger(ownerId: string, chargerId: string, input: unknown) {
  await ownCharger(ownerId, chargerId);
  const v = parseCharger(input);
  const { photoIds, ...data } = v;
  // Existing bookings keep their pricing snapshot — price edits only affect new bookings.
  await db.update(chargers).set({ ...data, updatedAt: new Date() }).where(eq(chargers.id, chargerId));
  await attachPhotos(ownerId, chargerId, photoIds);
}

export async function setAvailabilityRules(ownerId: string, chargerId: string, rules: unknown) {
  await ownCharger(ownerId, chargerId);
  const r = rulesSchema.safeParse(rules);
  if (!r.success) throw invalid(r.error.issues[0].message);
  await db.transaction(async (tx) => {
    await tx.delete(availabilityRules).where(eq(availabilityRules.chargerId, chargerId));
    if (r.data.length) await tx.insert(availabilityRules).values(r.data.map((x) => ({ ...x, chargerId })));
  });
}

export async function addAvailabilityBlock(ownerId: string, chargerId: string, startAt: Date, endAt: Date, reason: string) {
  await ownCharger(ownerId, chargerId);
  if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt)
    throw invalid("The block must end after it starts");
  if (endAt.getTime() - startAt.getTime() > 90 * 86400_000) throw invalid("Blocks can be at most 90 days long");
  await db.insert(availabilityBlocks).values({ chargerId, startAt, endAt, reason: reason.slice(0, 200) });
}

export async function removeAvailabilityBlock(ownerId: string, chargerId: string, blockId: string) {
  await ownCharger(ownerId, chargerId);
  await db.delete(availabilityBlocks).where(and(eq(availabilityBlocks.id, blockId), eq(availabilityBlocks.chargerId, chargerId)));
}

export async function setChargerStatus(ownerId: string, chargerId: string, status: "active" | "paused" | "removed") {
  const c = await ownCharger(ownerId, chargerId);
  if (status === "active") {
    const [owner] = await db.select({ phoneVerifiedAt: users.phoneVerifiedAt }).from(users).where(eq(users.id, ownerId));
    if (!owner?.phoneVerifiedAt)
      throw new AppError("FORBIDDEN", "Verify your phone number before publishing a listing (Profile → Phone verification).");
    const rules = await db.select({ id: availabilityRules.id }).from(availabilityRules).where(eq(availabilityRules.chargerId, chargerId)).limit(1);
    if (!rules.length) throw invalid("Add at least one availability window before publishing.");
  }
  if (status === "removed") {
    const upcoming = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.chargerId, chargerId), inArray(bookings.status, ["pending", "confirmed"]), gt(bookings.endAt, new Date())));
    if (upcoming.length)
      throw new AppError("INVALID_STATE", `This charger has ${upcoming.length} open booking(s). Resolve or cancel them before removing it.`);
  }
  await db.update(chargers).set({ status, updatedAt: new Date() }).where(eq(chargers.id, chargerId));
  await audit(db, { actorId: ownerId, entityType: "charger", entityId: chargerId, action: "status_changed", fromStatus: c.status, toStatus: status });
}

export async function listOwnerChargers(ownerId: string) {
  const rows = await db
    .select()
    .from(chargers)
    .where(and(eq(chargers.ownerId, ownerId), ne(chargers.status, "removed")))
    .orderBy(desc(chargers.createdAt));
  const photos = rows.length
    ? await db.select().from(chargerPhotos).where(inArray(chargerPhotos.chargerId, rows.map((r) => r.id))).orderBy(asc(chargerPhotos.sortOrder))
    : [];
  return rows.map((r) => ({ ...r, photos: photos.filter((p) => p.chargerId === r.id) }));
}

/** Full listing for its owner (includes the private address). */
export async function getOwnerCharger(ownerId: string, chargerId: string) {
  const c = await ownCharger(ownerId, chargerId);
  const [photos, rules, blocks] = await Promise.all([
    db.select().from(chargerPhotos).where(eq(chargerPhotos.chargerId, chargerId)).orderBy(asc(chargerPhotos.sortOrder)),
    db.select().from(availabilityRules).where(eq(availabilityRules.chargerId, chargerId)).orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startMinute)),
    db
      .select()
      .from(availabilityBlocks)
      .where(and(eq(availabilityBlocks.chargerId, chargerId), gt(availabilityBlocks.endAt, new Date())))
      .orderBy(asc(availabilityBlocks.startAt)),
  ]);
  return { ...c, photos, rules, blocks };
}

export async function unattachedPhotos(userId: string, ids: string[]) {
  if (!ids.length) return [];
  return db
    .select()
    .from(chargerPhotos)
    .where(and(inArray(chargerPhotos.id, ids), eq(chargerPhotos.uploadedBy, userId), isNull(chargerPhotos.chargerId)));
}
