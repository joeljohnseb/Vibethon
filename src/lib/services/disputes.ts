import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, disputes } from "@/lib/db/schema";
import { invalid, notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";

export const DISPUTE_CATEGORIES = {
  billing: "Billing or battery reading",
  no_show: "Host or driver didn't show up",
  access: "Couldn't access the charger",
  safety: "Safety concern",
  damage: "Damage to vehicle or property",
  payment: "Payment problem",
  other: "Something else",
} as const;

export async function createDispute(userId: string, input: { bookingRef?: string; category: string; description: string }) {
  rateLimit(`dispute:${userId}`, 10, 3600_000);
  if (!(input.category in DISPUTE_CATEGORIES)) throw invalid("Choose a category", { category: "Required" });
  const description = (input.description ?? "").trim();
  if (description.length < 20) throw invalid("Please describe the problem in a bit more detail (20+ characters)", { description: "Too short" });
  let bookingId: string | null = null;
  const ref = input.bookingRef?.trim().toUpperCase();
  if (ref) {
    const [b] = await db.select().from(bookings).where(eq(bookings.reference, ref));
    if (!b || (b.takerId !== userId && b.giverId !== userId)) throw invalid("We couldn't find that booking on your account", { bookingRef: "Not found" });
    bookingId = b.id;
  }
  const [d] = await db
    .insert(disputes)
    .values({ reporterId: userId, bookingId, category: input.category, description: description.slice(0, 4000) })
    .returning();
  return d;
}

export async function listMyDisputes(userId: string) {
  return db
    .select({ d: disputes, reference: bookings.reference })
    .from(disputes)
    .leftJoin(bookings, eq(bookings.id, disputes.bookingId))
    .where(eq(disputes.reporterId, userId))
    .orderBy(desc(disputes.createdAt));
}

export async function getDispute(id: string) {
  const [d] = await db.select().from(disputes).where(eq(disputes.id, id));
  if (!d) throw notFound("Dispute");
  return d;
}
