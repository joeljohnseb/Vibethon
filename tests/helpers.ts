import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { __setDb, type DB } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { resetRateLimits } from "@/lib/ratelimit";
import { addDays, localDate, zonedInstant } from "@/lib/time";

export async function freshDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  __setDb(db as unknown as DB, () => client.close());
  resetRateLimits();
  return db as unknown as DB;
}

let n = 0;
export async function makeUser(db: DB, opts: { name?: string; verified?: boolean } = {}) {
  n++;
  const [u] = await db
    .insert(schema.users)
    .values({
      name: opts.name ?? `User ${n}`,
      email: `user${n}-${Math.random().toString(36).slice(2, 7)}@test.dev`,
      phone: opts.verified ? `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}` : null,
      phoneVerifiedAt: opts.verified ? new Date() : null,
    })
    .returning();
  return u;
}

export async function makeCharger(db: DB, ownerId: string, opts: Partial<typeof schema.chargers.$inferInsert> = {}) {
  const [c] = await db
    .insert(schema.chargers)
    .values({
      ownerId,
      title: "Test Home Charger",
      addressLine: "12 Secret Lane",
      locality: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560038",
      lat: 12.97,
      lng: 77.64,
      connectors: ["type2"],
      powerKw: 7.4,
      pricePerKwhPaise: 1200,
      status: "active",
      ...opts,
    })
    .returning();
  // Open every day, all day.
  await db.insert(schema.availabilityRules).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ chargerId: c.id, weekday, startMinute: 0, endMinute: 1440 })));
  return c;
}

export async function makeVehicle(db: DB, userId: string, opts: Partial<typeof schema.vehicles.$inferInsert> = {}) {
  const [v] = await db
    .insert(schema.vehicles)
    .values({ userId, name: "My car", model: "Test EV", batteryKwh: 60, connectors: ["type2", "ccs2"], isDefault: true, ...opts })
    .returning();
  return v;
}

/** Tomorrow at HH:00 IST. */
export function tomorrowAt(hour: number, plusDays = 1) {
  return zonedInstant(addDays(localDate(new Date()), plusDays), hour * 60);
}
