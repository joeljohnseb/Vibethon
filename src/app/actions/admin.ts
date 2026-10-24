"use server";

import { act, str, type ActionState } from "@/lib/action";
import { requireAdmin } from "@/lib/auth/session";
import * as admin from "@/lib/services/admin";
import { updatePayout } from "@/lib/services/earnings";

export async function adminSuspendAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const a = await requireAdmin();
    const suspend = str(fd, "suspend") === "1";
    await admin.adminSetSuspended(a.id, str(fd, "userId"), suspend);
    return suspend ? "User suspended" : "User reinstated";
  });
}

export async function adminChargerStatusAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const a = await requireAdmin();
    await admin.adminSetChargerStatus(a.id, str(fd, "chargerId"), str(fd, "status") as "active" | "paused" | "removed");
    return "Listing updated";
  });
}

export async function adminCancelBookingAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const a = await requireAdmin();
    await admin.adminCancelBooking(a.id, str(fd, "bookingId"), str(fd, "reason") || "Policy violation");
    return "Booking cancelled";
  });
}

export async function adminReportAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const a = await requireAdmin();
    await admin.adminResolveReport(a.id, str(fd, "reportId"), str(fd, "action") === "hide" ? "hide" : "dismiss");
    return "Report resolved";
  });
}

export async function adminDisputeAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const a = await requireAdmin();
    await admin.adminUpdateDispute(a.id, str(fd, "disputeId"), str(fd, "status") as "open" | "investigating" | "resolved" | "dismissed", str(fd, "resolution"));
    return "Dispute updated";
  });
}

export async function adminPayoutAction(_: ActionState, fd: FormData) {
  return act(async () => {
    const a = await requireAdmin();
    await updatePayout(a.id, str(fd, "payoutId"), str(fd, "status") as "processing" | "paid" | "failed", str(fd, "providerRef"), str(fd, "note"));
    return "Payout updated";
  });
}
