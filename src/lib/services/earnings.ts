import { and, desc, eq, inArray, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, earnings, payouts } from "@/lib/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { audit, notify } from "./notify";
import { formatPaise } from "@/lib/money";

export async function earningsSummary(giverId: string) {
  const rows = await db
    .select({ status: earnings.status, net: sum(earnings.netPaise) })
    .from(earnings)
    .where(eq(earnings.giverId, giverId))
    .groupBy(earnings.status);
  const get = (s: string) => Number(rows.find((r) => r.status === s)?.net ?? 0);
  return { unpaid: get("unpaid"), inPayout: get("in_payout"), paidOut: get("paid_out"), lifetime: get("unpaid") + get("in_payout") + get("paid_out") };
}

export async function listEarnings(giverId: string) {
  return db
    .select({ e: earnings, reference: bookings.reference, startAt: bookings.startAt })
    .from(earnings)
    .innerJoin(bookings, eq(bookings.id, earnings.bookingId))
    .where(eq(earnings.giverId, giverId))
    .orderBy(desc(earnings.createdAt));
}

export async function listPayouts(giverId: string) {
  return db.select().from(payouts).where(eq(payouts.giverId, giverId)).orderBy(desc(payouts.createdAt));
}

/** Bundle all unpaid earnings into a payout request. Funds are only "transferred" once an admin confirms the payout. */
export async function requestPayout(giverId: string) {
  return db.transaction(async (tx) => {
    const unpaid = await tx.select().from(earnings).where(and(eq(earnings.giverId, giverId), eq(earnings.status, "unpaid"))).for("update");
    const amount = unpaid.reduce((a, e) => a + e.netPaise, 0);
    if (amount < 100) throw new AppError("INVALID_STATE", "You need at least ₹1 in unpaid earnings to request a payout");
    const [p] = await tx.insert(payouts).values({ giverId, amountPaise: amount, status: "requested" }).returning();
    await tx
      .update(earnings)
      .set({ status: "in_payout", payoutId: p.id })
      .where(and(eq(earnings.giverId, giverId), eq(earnings.status, "unpaid"), inArray(earnings.id, unpaid.map((e) => e.id))));
    await audit(tx, { actorId: giverId, entityType: "payout", entityId: p.id, action: "requested", toStatus: "requested", meta: { amount } });
    return p;
  });
}

/** Admin: move a payout through processing → paid / failed. */
export async function updatePayout(adminId: string, payoutId: string, status: "processing" | "paid" | "failed", providerRef?: string, note?: string) {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for("update");
    if (!p) throw notFound("Payout");
    const allowed: Record<string, string[]> = { requested: ["processing", "paid", "failed"], processing: ["paid", "failed"], paid: [], failed: [] };
    if (!allowed[p.status].includes(status)) throw new AppError("INVALID_STATE", `Cannot change payout from ${p.status} to ${status}`);
    if (status === "paid" && !providerRef?.trim()) throw new AppError("VALIDATION", "Enter the bank / UTR reference to confirm a payout");
    await tx
      .update(payouts)
      .set({ status, providerRef: providerRef?.trim() || p.providerRef, note: note?.trim() || p.note, confirmedAt: status === "paid" ? new Date() : null, updatedAt: new Date() })
      .where(eq(payouts.id, payoutId));
    if (status === "paid") await tx.update(earnings).set({ status: "paid_out" }).where(eq(earnings.payoutId, payoutId));
    if (status === "failed") await tx.update(earnings).set({ status: "unpaid", payoutId: null }).where(eq(earnings.payoutId, payoutId));
    await audit(tx, { actorId: adminId, entityType: "payout", entityId: payoutId, action: `status:${status}`, fromStatus: p.status, toStatus: status });
    const msg =
      status === "paid"
        ? `${formatPaise(p.amountPaise)} was transferred to you (ref ${providerRef}).`
        : status === "failed"
          ? `Your payout of ${formatPaise(p.amountPaise)} failed. The amount is back in your balance.`
          : `Your payout of ${formatPaise(p.amountPaise)} is being processed.`;
    await notify(tx, p.giverId, "payout_update", status === "paid" ? "Payout sent" : status === "failed" ? "Payout failed" : "Payout processing", msg, "/host/earnings");
  });
}
