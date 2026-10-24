"use server";

import { redirect } from "next/navigation";
import { act, str, type ActionState } from "@/lib/action";
import { requireUser } from "@/lib/auth/session";
import { cancelBooking, createBooking } from "@/lib/services/bookings";
import { issueStartCode } from "@/lib/services/charging";
import { refreshPaymentStatus, simulateSandboxPayment, startCheckout, verifyRazorpayCheckout } from "@/lib/services/payments";
import { createReview, reportReview } from "@/lib/services/reviews";
import { createDispute } from "@/lib/services/disputes";

export async function createBookingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await act(async () => {
    const u = await requireUser();
    const b = await createBooking(u.id, {
      chargerId: str(fd, "chargerId"),
      vehicleId: str(fd, "vehicleId"),
      startAt: str(fd, "startAt"),
      slotCount: Number(str(fd, "slotCount")),
      note: str(fd, "note"),
      idempotencyKey: str(fd, "idempotencyKey"),
    });
    id = b.id;
  });
  if (!res.ok) return res;
  redirect(`/bookings/${id}?new=1`);
}

export async function cancelBookingAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await cancelBooking(u.id, str(fd, "bookingId"), str(fd, "reason"));
    return "Booking cancelled";
  });
}

export async function issueCodeAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    const r = await issueStartCode(u.id, str(fd, "bookingId"));
    return { data: { code: r.code, expiresAt: r.expiresAt.toISOString() } };
  });
}

export async function startCheckoutAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let sandboxOrder = "";
  const res = await act(async () => {
    const u = await requireUser();
    const co = await startCheckout(u.id, str(fd, "bookingId"));
    if (co.provider === "sandbox") sandboxOrder = co.orderId;
    return { data: co as unknown as Record<string, unknown> };
  });
  if (res.ok && sandboxOrder) redirect(`/pay/sandbox/${sandboxOrder}`);
  return res;
}

export async function verifyRazorpayAction(input: { bookingId: string; orderId: string; paymentId: string; signature: string }) {
  return act(async () => {
    const u = await requireUser();
    const status = await verifyRazorpayCheckout(u.id, input.bookingId, input.orderId, input.paymentId, input.signature);
    return { data: { status } };
  });
}

export async function refreshPaymentAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await refreshPaymentStatus(u.id, str(fd, "bookingId"));
    return "Payment status refreshed";
  });
}

export async function sandboxPayAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let bookingId = "";
  const res = await act(async () => {
    const u = await requireUser();
    const outcome = str(fd, "outcome") as "success" | "failure" | "pending";
    bookingId = await simulateSandboxPayment(u.id, str(fd, "orderId"), outcome, str(fd, "method") || "upi");
  });
  if (!res.ok) return res;
  redirect(`/bookings/${bookingId}/pay?returned=1`);
}

export async function reviewAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await createReview(u.id, str(fd, "bookingId"), Number(str(fd, "rating")), str(fd, "comment"));
    return "Thanks — your review has been posted";
  });
}

export async function reportReviewAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await reportReview(u.id, str(fd, "reviewId"), str(fd, "reason"));
    return "Reported. Our team will take a look.";
  });
}

export async function disputeAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const u = await requireUser();
    await createDispute(u.id, { bookingRef: str(fd, "bookingRef"), category: str(fd, "category"), description: str(fd, "description") });
    return "Report submitted. We'll get back to you via notifications.";
  });
}
