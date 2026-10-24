/**
 * Development seed. Run with the dev server stopped:  npm run db:seed
 * Creates demo accounts (password for all: Eber@1234), chargers, vehicles,
 * past paid sessions with reviews, and a few live bookings to try the flow.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../src/lib/db";
import * as s from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { createBooking, decideBooking } from "../src/lib/services/bookings";
import { calculateBill } from "../src/lib/billing";
import { bookingReference, invoiceNumber } from "../src/lib/codes";
import { addDays, localDate, zonedInstant } from "../src/lib/time";

const PASSWORD = "Eber@1234";

async function main() {
  const existing = await db.select({ id: s.users.id }).from(s.users).limit(1);
  if (existing.length && !process.argv.includes("--force")) {
    console.log("Database already has data. Re-run with --force to wipe and reseed (npm run db:reset).");
    return;
  }
  if (existing.length) {
    const tables = [
      "admin_actions", "audit_logs", "review_reports", "reviews", "disputes", "notifications", "earnings", "payouts",
      "webhook_events", "payments", "invoices", "battery_readings", "confirmation_codes", "charging_sessions",
      "booking_slot_locks", "bookings", "availability_blocks", "availability_rules", "charger_photos", "chargers",
      "vehicles", "otp_codes", "sessions", "auth_identities", "users",
    ];
    await db.execute(sql.raw(`TRUNCATE ${tables.join(", ")} CASCADE`));
  }

  const pw = await hashPassword(PASSWORD);
  const mkUser = async (name: string, email: string, phone: string | null, extra: Partial<typeof s.users.$inferInsert> = {}) => {
    const [u] = await db
      .insert(s.users)
      .values({ name, email, passwordHash: pw, phone, phoneVerifiedAt: phone ? new Date() : null, emailVerifiedAt: new Date(), ...extra })
      .returning();
    await db.insert(s.authIdentities).values({ userId: u.id, provider: "email", providerUserId: email });
    return u;
  };

  const admin = await mkUser("Eber Admin", "admin@eber.dev", "+919800000000", { isAdmin: true });
  const driver = await mkUser("Aarav Sharma", "driver@eber.dev", "+919800000010");
  const driver2 = await mkUser("Diya Nair", "diya@eber.dev", "+919800000011");
  const host = await mkUser("Priya Raman", "host@eber.dev", "+919800000001", { activeRole: "giver" });
  const host2 = await mkUser("Rohan Mehta", "rohan@eber.dev", "+919800000002", { activeRole: "giver" });
  const host3 = await mkUser("Anjali Menon", "anjali@eber.dev", "+919800000003", { activeRole: "giver" });
  await mkUser("New Host (unverified)", "newhost@eber.dev", null, { activeRole: "giver" });

  const [nexon] = await db
    .insert(s.vehicles)
    .values({ userId: driver.id, name: "Daily driver", model: "Tata Nexon EV Max", batteryKwh: 40.5, connectors: ["ccs2", "type2"], isDefault: true })
    .returning();
  await db.insert(s.vehicles).values({ userId: driver.id, name: "Weekend car", model: "Hyundai Ioniq 5", batteryKwh: 72.6, connectors: ["ccs2", "type2"] });
  const [zs] = await db
    .insert(s.vehicles)
    .values({ userId: driver2.id, name: "ZS", model: "MG ZS EV", batteryKwh: 50.3, connectors: ["ccs2", "type2"], isDefault: true })
    .returning();
  // Host also drives an EV (one account, both roles).
  await db.insert(s.vehicles).values({ userId: host.id, name: "Comet", model: "MG Comet EV", batteryKwh: 17.3, connectors: ["type2"], isDefault: true });

  type C = Omit<typeof s.chargers.$inferInsert, "ownerId"> & { hours?: [number, number][]; days?: number[] };
  const base = { state: "Karnataka", city: "Bengaluru", status: "active" as const };
  const chargers: [typeof host, C][] = [
    [host, { ...base, title: "Covered driveway charger, 7.4 kW", description: "Wall-mounted Type 2 charger in a covered driveway off a quiet lane. Room for one car up to SUV size. I'm usually home and can help you plug in.", addressLine: "No. 14, 3rd Cross, HAL 2nd Stage", locality: "Indiranagar", postalCode: "560038", lat: 12.9719, lng: 77.6412, connectors: ["type2"], powerKw: 7.4, pricePerKwhPaise: 1200, parkingInfo: "Covered driveway, one car. Gate stays open during your slot.", accessInstructions: "Ring the bell at the green gate. The charger is on the left wall; the cable is in the grey box (unlocked).", safetyInfo: "RCD-protected circuit. Please don't extend the cable across the footpath.", amenities: ["Covered parking", "CCTV", "Well lit at night"], hours: [[0, 1440]], bookingMode: "approval", cancellationPolicy: "flexible" }],
    [host, { ...base, title: "Fast DC wallbox near Domlur", description: "25 kW CCS2 DC wallbox — top up 20→80% in about an hour on most cars.", addressLine: "22, Amarjyoti Layout", locality: "Domlur", postalCode: "560071", lat: 12.9606, lng: 77.6387, connectors: ["ccs2"], powerKw: 25, pricePerKwhPaise: 1850, parkingInfo: "Open parking in front of the house.", accessInstructions: "Park facing the garage. Call when you arrive.", safetyInfo: "Do not unplug while the screen shows 'Charging'. Press STOP first.", amenities: ["CCTV", "Waiting area", "Wi-Fi"], hours: [[7 * 60, 22 * 60]], bookingMode: "instant", cancellationPolicy: "moderate" }],
    [host2, { ...base, title: "Koramangala apartment basement charger", description: "Dedicated 11 kW three-phase charger in a secure apartment basement. Security will let you in with your booking reference.", addressLine: "Flat 3B, Lakeview Residency, 5th Block", locality: "Koramangala", postalCode: "560095", lat: 12.9352, lng: 77.6245, connectors: ["type2"], powerKw: 11, pricePerKwhPaise: 1400, parkingInfo: "Basement slot B-17, height limit 2.1 m.", accessInstructions: "Tell security you're visiting 3B for Eber and show your booking reference.", safetyInfo: "Basement has fire extinguishers near the lift lobby.", amenities: ["Covered parking", "Gated entry", "CCTV"], hours: [[6 * 60, 23 * 60]], bookingMode: "approval", cancellationPolicy: "strict" }],
    [host2, { ...base, title: "HSR Layout home charger (AC 3.3 kW)", description: "Slow but cheap — ideal for a long lunch or overnight top-up.", addressLine: "#811, 17th Main, Sector 3", locality: "HSR Layout", postalCode: "560102", lat: 12.9116, lng: 77.6474, connectors: ["bharat_ac001", "socket_15a", "type2"], powerKw: 3.3, pricePerKwhPaise: 900, parkingInfo: "Street-side parking right outside.", accessInstructions: "Cable is coiled near the gate post.", safetyInfo: "15A industrial socket with earth leakage protection.", amenities: ["Well lit at night"], hours: [[8 * 60, 20 * 60]], days: [1, 2, 3, 4, 5, 6], bookingMode: "approval", cancellationPolicy: "flexible" }],
    [host3, { title: "Seaside villa charger, Fort Kochi", description: "7 kW Type 2 in a private compound, five minutes from the beach.", addressLine: "Villa 9, Princess Street", locality: "Fort Kochi", city: "Kochi", state: "Kerala", postalCode: "682001", lat: 9.9658, lng: 76.2421, connectors: ["type2"], powerKw: 7.2, pricePerKwhPaise: 1100, parkingInfo: "Inside the compound.", accessInstructions: "Press the intercom for Villa 9.", safetyInfo: "", amenities: ["Gated entry", "Restroom access"], status: "active", hours: [[9 * 60, 21 * 60]], bookingMode: "approval", cancellationPolicy: "flexible" }],
    [host3, { title: "Edappally office-park charger", description: "CCS2 22 kW in a business park lot. Weekdays only.", addressLine: "Unit 4, Infopark Road", locality: "Edappally", city: "Kochi", state: "Kerala", postalCode: "682024", lat: 10.0261, lng: 76.3083, connectors: ["ccs2", "type2"], powerKw: 22, pricePerKwhPaise: 1600, parkingInfo: "Visitor lot, bay 3.", accessInstructions: "Show booking at the boom barrier.", safetyInfo: "", amenities: ["CCTV", "Waiting area"], status: "active", hours: [[9 * 60, 18 * 60]], days: [1, 2, 3, 4, 5], bookingMode: "instant", cancellationPolicy: "moderate" }],
  ];

  const created: s.Charger[] = [];
  for (const [owner, c] of chargers) {
    const { hours = [[0, 1440]], days = [0, 1, 2, 3, 4, 5, 6], ...data } = c;
    const [row] = await db.insert(s.chargers).values({ ...data, ownerId: owner.id }).returning();
    for (const d of days) for (const [a, b] of hours) await db.insert(s.availabilityRules).values({ chargerId: row.id, weekday: d, startMinute: a, endMinute: b });
    created.push(row);
  }

  // Past, paid sessions with reviews (inserted directly so they can be in the past).
  const today = localDate(new Date());
  const past = async (charger: s.Charger, taker: typeof driver, vehicle: s.Vehicle, daysAgo: number, startPct: number, endPct: number, takerRating: number, comment: string, hostRating: number) => {
    const startAt = zonedInstant(addDays(today, -daysAgo), 18 * 60);
    const endAt = zonedInstant(addDays(today, -daysAgo), 20 * 60);
    const [b] = await db
      .insert(s.bookings)
      .values({
        reference: bookingReference(), chargerId: charger.id, takerId: taker.id, giverId: charger.ownerId, vehicleId: vehicle.id,
        startAt, endAt, status: "completed", pricePerKwhPaise: charger.pricePerKwhPaise, vehicleBatteryKwh: vehicle.batteryKwh,
        vehicleLabel: `${vehicle.name} · ${vehicle.model}`, connector: charger.connectors[0], cancellationPolicy: charger.cancellationPolicy,
        bookingMode: charger.bookingMode, decidedAt: startAt, createdAt: new Date(startAt.getTime() - 86400_000),
      })
      .returning();
    const [sess] = await db.insert(s.chargingSessions).values({ bookingId: b.id, status: "completed", codeVerifiedAt: startAt, startedAt: startAt, endedAt: endAt, completedAt: endAt }).returning();
    await db.insert(s.batteryReadings).values([
      { sessionId: sess.id, kind: "start", percent: startPct, recordedBy: charger.ownerId, recordedAt: startAt },
      { sessionId: sess.id, kind: "end", percent: endPct, recordedBy: charger.ownerId, recordedAt: endAt },
    ]);
    const bill = calculateBill({ batteryKwh: vehicle.batteryKwh, startPercent: startPct, endPercent: endPct, pricePerKwhPaise: charger.pricePerKwhPaise });
    const [inv] = await db
      .insert(s.invoices)
      .values({
        number: invoiceNumber(), bookingId: b.id, sessionId: sess.id, batteryKwh: vehicle.batteryKwh, startPercent: startPct, endPercent: endPct,
        billableWh: bill.billableWh, pricePerKwhPaise: charger.pricePerKwhPaise, energyChargePaise: bill.energyChargePaise, platformFeePaise: 0, taxPaise: 0,
        adjustmentPaise: bill.adjustmentPaise, totalPaise: bill.totalPaise, giverEarningsPaise: bill.giverEarningsPaise, lines: bill.lines, status: "paid", issuedAt: endAt, paidAt: endAt,
      })
      .returning();
    await db.insert(s.payments).values({ invoiceId: inv.id, provider: "sandbox", providerOrderId: `order_SEED${b.reference.slice(4)}`, providerPaymentId: `pay_SEED${b.reference.slice(4)}`, amountPaise: inv.totalPaise, status: "captured", method: "upi" });
    await db.insert(s.earnings).values({ giverId: charger.ownerId, bookingId: b.id, invoiceId: inv.id, grossPaise: inv.totalPaise, platformFeePaise: 0, netPaise: inv.giverEarningsPaise, status: daysAgo > 10 ? "paid_out" : "unpaid" });
    await db.insert(s.reviews).values([
      { bookingId: b.id, authorId: taker.id, subjectUserId: charger.ownerId, chargerId: charger.id, direction: "taker_to_giver", rating: takerRating, comment },
      { bookingId: b.id, authorId: charger.ownerId, subjectUserId: taker.id, direction: "giver_to_taker", rating: hostRating, comment: "Punctual and careful with the cable. Welcome back anytime." },
    ]);
  };
  await past(created[0], driver, nexon, 3, 22, 80, 5, "Super easy — Priya had the cable ready and the driveway is covered. Will book again.", 5);
  await past(created[0], driver2, zs, 6, 35, 75, 4, "Good charger, slightly tricky to find the gate at night.", 5);
  await past(created[2], driver, nexon, 12, 18, 90, 5, "Security was expecting me. Basement is clean and well lit.", 4);
  await past(created[1], driver2, zs, 15, 20, 70, 5, "Fast DC charging at home prices. Great.", 5);
  await past(created[3], driver, nexon, 20, 40, 60, 4, "Slow but cheap, as described.", 5);
  const [paidOut] = await db.select().from(s.earnings).where(sql`${s.earnings.status} = 'paid_out'`).limit(1);
  if (paidOut) {
    const [p] = await db.insert(s.payouts).values({ giverId: paidOut.giverId, amountPaise: paidOut.netPaise, status: "paid", providerRef: "UTR-SEED-0001", confirmedAt: new Date() }).returning();
    await db.update(s.earnings).set({ payoutId: p.id }).where(sql`${s.earnings.id} = ${paidOut.id}`);
  }

  // Live bookings to try the flow.
  const nextHour = new Date(Math.ceil((Date.now() + 330 * 60_000) / 3600_000) * 3600_000 - 330 * 60_000); // next IST hour
  // 1) Confirmed booking for Aarav at Priya's charger starting at the next hour — the start code is available now.
  const live = await createBooking(driver.id, { chargerId: created[0].id, vehicleId: nexon.id, startAt: nextHour, slotCount: 2, note: "Seeded demo booking" });
  await decideBooking(host.id, live.id, "approve");
  // 2) Pending request from Diya at Priya's charger tomorrow evening.
  await createBooking(driver2.id, { chargerId: created[0].id, vehicleId: zs.id, startAt: zonedInstant(addDays(today, 1), 19 * 60), slotCount: 2, note: "Is it OK if I arrive 5 minutes early?" });
  // 3) Pending request from Aarav at Rohan's Koramangala charger in two days.
  await createBooking(driver.id, { chargerId: created[2].id, vehicleId: nexon.id, startAt: zonedInstant(addDays(today, 2), 10 * 60), slotCount: 3 });

  console.log(`✓ Seeded. Password for every account: ${PASSWORD}
  Driver:  driver@eber.dev  (has a confirmed booking starting ${nextHour.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST — open it to show the start code)
  Host:    host@eber.dev    (verify that code from Host → Bookings; also has a pending request)
  Host 2:  rohan@eber.dev   Driver 2: diya@eber.dev   Admin: admin@eber.dev
  Unverified host (cannot publish until phone verified): newhost@eber.dev`);
  void admin;
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
