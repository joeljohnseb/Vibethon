/**
 * Payment state management.
 *
 * The *only* paths that mark a payment captured are:
 *   1. a webhook whose signature verifies (Razorpay, or the signed sandbox), or
 *   2. a Checkout callback whose signature verifies AND whose status is then
 *      re-fetched server-side from the Razorpay API.
 * A browser "success" page alone never completes a session.
 * All handlers are idempotent: duplicate webhooks/callbacks are no-ops.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import {
  bookings,
  chargingSessions,
  disputes,
  earnings,
  invoices,
  payments,
  webhookEvents,
  type Payment,
} from "@/lib/db/schema";
import { config } from "@/lib/config";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { assertTransition, canTransition, paymentTransitions, sessionTransitions, type PaymentStatus, type SessionStatus } from "@/lib/state";
import { formatPaise } from "@/lib/money";
import { audit, notify } from "./notify";
import * as rzp from "@/lib/payments/razorpay";
import { buildSandboxEvent, sandboxOrderId, verifySandboxSignature, type SandboxOutcome } from "@/lib/payments/sandbox";

type Provider = "razorpay" | "sandbox";

async function setPaymentStatus(tx: Tx, p: Pick<Payment, "id" | "status">, to: PaymentStatus, patch: Partial<typeof payments.$inferInsert> = {}) {
  if (p.status === to) {
    if (Object.keys(patch).length) await tx.update(payments).set({ ...patch, updatedAt: new Date() }).where(eq(payments.id, p.id));
    return;
  }
  assertTransition("payment", paymentTransitions, p.status as PaymentStatus, to);
  await tx.update(payments).set({ ...patch, status: to, updatedAt: new Date() }).where(eq(payments.id, p.id));
  await audit(tx, { entityType: "payment", entityId: p.id, action: `status:${to}`, fromStatus: p.status, toStatus: to });
}

async function moveSession(tx: Tx, bookingId: string, to: SessionStatus, patch: Partial<typeof chargingSessions.$inferInsert> = {}) {
  const [s] = await tx.select().from(chargingSessions).where(eq(chargingSessions.bookingId, bookingId)).for("update");
  if (!s || s.status === to) return s;
  if (!canTransition(sessionTransitions, s.status as SessionStatus, to)) return s;
  await tx.update(chargingSessions).set({ ...patch, status: to, updatedAt: new Date() }).where(eq(chargingSessions.id, s.id));
  await audit(tx, { entityType: "session", entityId: s.id, action: `status:${to}`, fromStatus: s.status, toStatus: to });
  return s;
}

/**
 * Finalise a booking after verified payment (or a ₹0 bill): invoice paid,
 * session + booking completed, homeowner earning recorded, both users notified.
 */
export async function completePaidSession(
  tx: Tx,
  args: { bookingId: string; invoiceId: string; actorId: string | null; zeroAmount?: boolean },
) {
  const now = new Date();
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, args.invoiceId)).for("update");
  if (inv.status !== "paid") {
    await tx.update(invoices).set({ status: "paid", paidAt: now }).where(eq(invoices.id, inv.id));
    await audit(tx, { actorId: args.actorId, entityType: "invoice", entityId: inv.id, action: "paid", fromStatus: inv.status, toStatus: "paid" });
  }
  await moveSession(tx, args.bookingId, "completed", { completedAt: now });
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, args.bookingId)).for("update");
  if (b.status === "confirmed") {
    await tx.update(bookings).set({ status: "completed", updatedAt: now }).where(eq(bookings.id, b.id));
    await audit(tx, { actorId: args.actorId, entityType: "booking", entityId: b.id, action: "status:completed", fromStatus: "confirmed", toStatus: "completed" });
  }
  if (inv.giverEarningsPaise > 0) {
    await tx
      .insert(earnings)
      .values({
        giverId: b.giverId,
        bookingId: b.id,
        invoiceId: inv.id,
        grossPaise: inv.totalPaise,
        platformFeePaise: inv.totalPaise - inv.giverEarningsPaise,
        netPaise: inv.giverEarningsPaise,
      })
      .onConflictDoNothing();
  }
  if (args.zeroAmount) {
    await notify(tx, b.takerId, "session_completed", "Session completed — nothing to pay", `${b.reference}: no charge was delivered, so there's no bill.`, `/bookings/${b.id}`);
    await notify(tx, b.giverId, "session_completed", "Session completed", `${b.reference} closed with no charge delivered.`, `/host/bookings/${b.id}`);
  } else {
    await notify(tx, b.takerId, "payment_succeeded", "Payment successful", `${formatPaise(inv.totalPaise)} paid for ${b.reference}. Your receipt is ready.`, `/bookings/${b.id}/receipt`);
    await notify(tx, b.giverId, "payment_succeeded", "Payment received", `${b.reference} was paid. ${formatPaise(inv.giverEarningsPaise)} added to your earnings.`, `/host/bookings/${b.id}`);
  }
  await notify(tx, b.takerId, "session_completed", "Leave a review", `How was charging at this home? Rate your host for ${b.reference}.`, `/bookings/${b.id}#review`);
  await notify(tx, b.giverId, "session_completed", "Leave a review", `Rate the driver for ${b.reference}.`, `/host/bookings/${b.id}#review`);
}

/* ----------------------------------------------------------------------------
 * Checkout
 * --------------------------------------------------------------------------*/

async function payableContext(takerId: string, bookingId: string, tx: Tx) {
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
  if (!b || b.takerId !== takerId) throw notFound("Booking");
  const [s] = await tx.select().from(chargingSessions).where(eq(chargingSessions.bookingId, bookingId));
  const [inv] = await tx.select().from(invoices).where(eq(invoices.bookingId, bookingId)).for("update");
  if (!s || !inv) throw new AppError("INVALID_STATE", "There's no bill for this booking yet");
  if (inv.status === "paid" || s.status === "completed") throw new AppError("INVALID_STATE", "This bill has already been paid");
  if (!["awaiting_payment", "payment_failed", "payment_pending"].includes(s.status))
    throw new AppError("INVALID_STATE", "This booking isn't awaiting payment");
  return { b, s, inv };
}

export type CheckoutParams = {
  provider: Provider;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  keyId?: string;
  invoiceNumber: string;
  bookingReference: string;
};

/** Create (or reuse) a gateway order for the invoice. Reusing the order makes double charging impossible. */
export async function startCheckout(takerId: string, bookingId: string): Promise<CheckoutParams> {
  const mode = config.payments.mode;
  if (mode === "disabled") throw new AppError("CONFIG", "Payments are not configured");
  const provider: Provider = mode;

  // Phase 1: reuse an existing open order if there is one.
  const reuse = await db.transaction(async (tx) => {
    const { b, inv } = await payableContext(takerId, bookingId, tx);
    const [existing] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.invoiceId, inv.id), eq(payments.provider, provider), inArray(payments.status, ["created", "pending", "failed", "authorized"])))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    return { b, inv, existing };
  });
  const base = { provider, amountPaise: reuse.inv.totalPaise, currency: "INR" as const, invoiceNumber: reuse.inv.number, bookingReference: reuse.b.reference, keyId: provider === "razorpay" ? config.payments.razorpayKeyId : undefined };
  if (reuse.existing && reuse.existing.amountPaise === reuse.inv.totalPaise) return { ...base, orderId: reuse.existing.providerOrderId };

  // Phase 2: create the order with the gateway (outside the DB transaction), then record it.
  const orderId =
    provider === "razorpay"
      ? (await rzp.createOrder(reuse.inv.totalPaise, reuse.inv.number, { bookingId, invoiceId: reuse.inv.id })).id
      : sandboxOrderId();
  await db.transaction(async (tx) => {
    const { inv } = await payableContext(takerId, bookingId, tx);
    const [p] = await tx
      .insert(payments)
      .values({ invoiceId: inv.id, provider, providerOrderId: orderId, amountPaise: inv.totalPaise, status: "created" })
      .returning();
    await audit(tx, { actorId: takerId, entityType: "payment", entityId: p.id, action: "order_created", toStatus: "created", meta: { provider, orderId } });
  });
  return { ...base, orderId };
}

/* ----------------------------------------------------------------------------
 * Gateway events → state transitions (shared by webhooks, callbacks, sandbox)
 * --------------------------------------------------------------------------*/

type GatewayPayment = { orderId: string; paymentId: string; amount: number; currency: string; method?: string; error?: string };

async function applyCaptured(tx: Tx, provider: Provider, gp: GatewayPayment) {
  const [p] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.provider, provider), eq(payments.providerOrderId, gp.orderId)))
    .for("update");
  if (!p) throw new AppError("NOT_FOUND", `Unknown order ${gp.orderId}`);
  if (p.status === "captured") return { duplicate: true };
  if (gp.amount !== p.amountPaise || gp.currency !== "INR")
    throw new AppError("PAYMENT", `Amount mismatch for order ${gp.orderId}: expected ${p.amountPaise}, got ${gp.amount} ${gp.currency}`);

  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, p.invoiceId)).for("update");
  if (inv.status === "paid") {
    // Paid twice via different orders — flag for a refund instead of double-crediting.
    await tx.update(payments).set({ providerPaymentId: gp.paymentId, failureReason: "Duplicate payment — refund required", updatedAt: new Date() }).where(eq(payments.id, p.id));
    await tx.insert(disputes).values({
      bookingId: inv.bookingId,
      reporterId: (await tx.select({ t: bookings.takerId }).from(bookings).where(eq(bookings.id, inv.bookingId)))[0].t,
      category: "duplicate_payment",
      description: `Automatic: payment ${gp.paymentId} on order ${gp.orderId} arrived after invoice ${inv.number} was already paid. Refund required.`,
    });
    return { duplicate: true };
  }
  await setPaymentStatus(tx, p, "captured", { providerPaymentId: gp.paymentId, method: gp.method ?? null, failureReason: null });
  await completePaidSession(tx, { bookingId: inv.bookingId, invoiceId: inv.id, actorId: null });
  return { duplicate: false };
}

async function applyNonFinal(tx: Tx, provider: Provider, gp: GatewayPayment, to: "failed" | "pending" | "authorized") {
  const [p] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.provider, provider), eq(payments.providerOrderId, gp.orderId)))
    .for("update");
  if (!p) throw new AppError("NOT_FOUND", `Unknown order ${gp.orderId}`);
  if (p.status === "captured") return; // a late failure of another attempt doesn't undo a success
  if (!canTransition(paymentTransitions, p.status as PaymentStatus, to) && p.status !== to) return;
  await setPaymentStatus(tx, p, to, {
    providerPaymentId: gp.paymentId,
    method: gp.method ?? null,
    failureReason: to === "failed" ? (gp.error ?? "Payment failed") : null,
  });
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, p.invoiceId));
  const [b] = await tx.select().from(bookings).where(eq(bookings.id, inv.bookingId));
  if (to === "failed") {
    await moveSession(tx, b.id, "payment_failed");
    await notify(tx, b.takerId, "payment_failed", "Payment failed", `Your payment for ${b.reference} didn't go through${gp.error ? `: ${gp.error}` : "."} You can retry from your booking.`, `/bookings/${b.id}/pay`);
  } else {
    await moveSession(tx, b.id, "payment_pending");
  }
}

function parseGatewayEvent(raw: string) {
  const evt = JSON.parse(raw) as {
    event?: string;
    payload?: { payment?: { entity?: Record<string, unknown> }; order?: { entity?: Record<string, unknown> } };
  };
  const e = evt.payload?.payment?.entity ?? {};
  const gp: GatewayPayment = {
    orderId: String(e.order_id ?? evt.payload?.order?.entity?.id ?? ""),
    paymentId: String(e.id ?? ""),
    amount: Number(e.amount ?? NaN),
    currency: String(e.currency ?? ""),
    method: e.method ? String(e.method) : undefined,
    error: e.error_description ? String(e.error_description) : undefined,
  };
  return { type: String(evt.event ?? ""), gp, payload: evt };
}

/**
 * Verify, de-duplicate and apply a gateway webhook. Returns a status string;
 * throws only for signature failures (→ 400).
 */
export async function handleWebhook(provider: Provider, rawBody: string, signature: string, eventIdHeader?: string | null) {
  const valid = provider === "razorpay" ? rzp.verifyWebhookSignature(rawBody, signature) : config.sandboxAllowed && verifySandboxSignature(rawBody, signature);
  if (!valid) throw new AppError("FORBIDDEN", "Invalid webhook signature");

  let parsed: ReturnType<typeof parseGatewayEvent>;
  try {
    parsed = parseGatewayEvent(rawBody);
  } catch {
    throw new AppError("VALIDATION", "Malformed webhook body");
  }
  const eventId = eventIdHeader || `${parsed.type}:${parsed.gp.paymentId}:${parsed.gp.orderId}`;

  const inserted = await db
    .insert(webhookEvents)
    .values({ provider, eventId, eventType: parsed.type, payload: parsed.payload })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  let rowId = inserted[0]?.id;
  if (!rowId) {
    const [existing] = await db
      .select()
      .from(webhookEvents)
      .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)));
    if (existing?.processedAt) return "duplicate";
    rowId = existing.id; // previously failed — retry processing
  }

  try {
    await db.transaction(async (tx) => {
      switch (parsed.type) {
        case "payment.captured":
        case "order.paid":
          await applyCaptured(tx, provider, parsed.gp);
          break;
        case "payment.failed":
          await applyNonFinal(tx, provider, parsed.gp, "failed");
          break;
        case "payment.authorized":
          await applyNonFinal(tx, provider, parsed.gp, "authorized");
          break;
        case "payment.pending":
          await applyNonFinal(tx, provider, parsed.gp, "pending");
          break;
        default:
          break; // acknowledged but ignored
      }
      await tx.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, rowId!));
    });
    return "processed";
  } catch (e) {
    await db.update(webhookEvents).set({ error: String((e as Error).message).slice(0, 500) }).where(eq(webhookEvents.id, rowId));
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "PAYMENT")) return "ignored";
    throw e;
  }
}

/** Razorpay Checkout handler callback: verify signature, then confirm with the API before trusting it. */
export async function verifyRazorpayCheckout(takerId: string, bookingId: string, orderId: string, paymentId: string, signature: string) {
  if (config.payments.mode !== "razorpay") throw new AppError("CONFIG", "Razorpay is not configured");
  const [p] = await db
    .select({ p: payments, takerId: bookings.takerId, bookingId: bookings.id })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
    .where(and(eq(payments.provider, "razorpay"), eq(payments.providerOrderId, orderId)));
  if (!p || p.takerId !== takerId || p.bookingId !== bookingId) throw forbidden();
  if (!rzp.verifyCheckoutSignature(orderId, paymentId, signature)) throw new AppError("PAYMENT", "Payment signature could not be verified");
  const live = await rzp.fetchPayment(paymentId);
  if (live.order_id !== orderId) throw new AppError("PAYMENT", "Payment does not belong to this order");
  const gp = { orderId, paymentId, amount: live.amount, currency: live.currency, method: live.method, error: live.error_description };
  await db.transaction(async (tx) => {
    if (live.status === "captured") await applyCaptured(tx, "razorpay", gp);
    else if (live.status === "failed") await applyNonFinal(tx, "razorpay", gp, "failed");
    else await applyNonFinal(tx, "razorpay", gp, live.status === "authorized" ? "authorized" : "pending");
  });
  return live.status;
}

/** Re-check the gateway for a pending payment (Razorpay only). */
export async function refreshPaymentStatus(takerId: string, bookingId: string) {
  if (config.payments.mode !== "razorpay") return;
  const rows = await db
    .select({ p: payments, takerId: bookings.takerId })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
    .where(and(eq(bookings.id, bookingId), eq(payments.provider, "razorpay")));
  if (!rows.length || rows[0].takerId !== takerId) return;
  for (const { p } of rows) {
    if (p.status === "captured") continue;
    const { items } = await rzp.fetchOrderPayments(p.providerOrderId);
    const captured = items.find((i) => i.status === "captured");
    await db.transaction(async (tx) => {
      if (captured)
        await applyCaptured(tx, "razorpay", { orderId: p.providerOrderId, paymentId: captured.id, amount: captured.amount, currency: captured.currency, method: captured.method });
    });
  }
}

/** Sandbox only: simulate the gateway sending a signed webhook for this order. */
export async function simulateSandboxPayment(takerId: string, orderId: string, outcome: SandboxOutcome, method = "upi") {
  if (config.payments.mode !== "sandbox") throw new AppError("CONFIG", "Sandbox payments are disabled");
  const [row] = await db
    .select({ p: payments, takerId: bookings.takerId, bookingId: bookings.id })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
    .where(and(eq(payments.provider, "sandbox"), eq(payments.providerOrderId, orderId)));
  if (!row || row.takerId !== takerId) throw forbidden();
  const evt = buildSandboxEvent(orderId, row.p.amountPaise, outcome, method);
  await handleWebhook("sandbox", evt.body, evt.signature, evt.eventId);
  return row.bookingId;
}
