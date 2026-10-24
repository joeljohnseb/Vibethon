import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { CONNECTOR_IDS } from "@/lib/constants";
import { invalid, notFound } from "@/lib/errors";

export const vehicleSchema = z.object({
  name: z.string().trim().min(1, "Give your vehicle a name").max(60),
  model: z.string().trim().min(2, "Enter the make and model").max(80),
  batteryKwh: z.coerce
    .number({ message: "Enter the battery capacity" })
    .gt(0, "Battery capacity must be more than 0")
    .max(300, "That seems too large — check the kWh value"),
  connectors: z.array(z.enum(CONNECTOR_IDS)).min(1, "Select at least one connector your car supports"),
  isDefault: z.boolean().optional(),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

function parse(input: unknown) {
  const r = vehicleSchema.safeParse(input);
  if (!r.success) {
    const fe: Record<string, string> = {};
    for (const i of r.error.issues) fe[String(i.path[0])] ??= i.message;
    throw invalid("Please fix the highlighted fields", fe);
  }
  return r.data;
}

export async function listVehicles(userId: string) {
  return db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.userId, userId), isNull(vehicles.deletedAt)))
    .orderBy(vehicles.createdAt);
}

export async function createVehicle(userId: string, input: unknown) {
  const v = parse(input);
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.userId, userId), isNull(vehicles.deletedAt)));
    if (existing.length >= 10) throw invalid("You can register up to 10 vehicles");
    const makeDefault = v.isDefault || existing.length === 0;
    if (makeDefault) await tx.update(vehicles).set({ isDefault: false }).where(eq(vehicles.userId, userId));
    const [row] = await tx
      .insert(vehicles)
      .values({ userId, name: v.name, model: v.model, batteryKwh: v.batteryKwh, connectors: v.connectors, isDefault: makeDefault })
      .returning();
    return row;
  });
}

export async function updateVehicle(userId: string, vehicleId: string, input: unknown) {
  const v = parse(input);
  await db.transaction(async (tx) => {
    const [own] = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId), isNull(vehicles.deletedAt)));
    if (!own) throw notFound("Vehicle");
    if (v.isDefault) await tx.update(vehicles).set({ isDefault: false }).where(eq(vehicles.userId, userId));
    // Existing bookings keep their own battery snapshot, so editing is safe.
    await tx
      .update(vehicles)
      .set({ name: v.name, model: v.model, batteryKwh: v.batteryKwh, connectors: v.connectors, ...(v.isDefault ? { isDefault: true } : {}) })
      .where(eq(vehicles.id, vehicleId));
  });
}

export async function deleteVehicle(userId: string, vehicleId: string) {
  const res = await db
    .update(vehicles)
    .set({ deletedAt: new Date(), isDefault: false })
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId), isNull(vehicles.deletedAt)))
    .returning({ id: vehicles.id });
  if (!res.length) throw notFound("Vehicle");
}
