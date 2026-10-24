"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { inputClass } from "./ui";
import { adminCancelBookingAction, adminChargerStatusAction, adminDisputeAction, adminPayoutAction, adminReportAction, adminSuspendAction } from "@/app/actions/admin";

const small = inputClass + " h-9 text-sm";

export function SuspendForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  return (
    <ActionForm action={adminSuspendAction} showMessage>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="suspend" value={suspended ? "0" : "1"} />
      <SubmitButton size="sm" variant={suspended ? "secondary" : "danger"}>{suspended ? "Reinstate" : "Suspend"}</SubmitButton>
    </ActionForm>
  );
}

export function ChargerStatusForm({ chargerId, status }: { chargerId: string; status: string }) {
  return (
    <ActionForm action={adminChargerStatusAction} className="flex gap-1.5">
      <input type="hidden" name="chargerId" value={chargerId} />
      {status !== "paused" && status !== "removed" && <SubmitButton size="sm" variant="secondary" name="status" value="paused">Pause</SubmitButton>}
      {status === "paused" && <SubmitButton size="sm" variant="secondary" name="status" value="active">Activate</SubmitButton>}
      {status !== "removed" && <SubmitButton size="sm" variant="danger" name="status" value="removed">Remove</SubmitButton>}
    </ActionForm>
  );
}

export function AdminCancelForm({ bookingId }: { bookingId: string }) {
  return (
    <ActionForm action={adminCancelBookingAction} className="flex gap-1.5">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input name="reason" placeholder="Reason" className={small + " w-36"} />
      <SubmitButton size="sm" variant="danger">Cancel</SubmitButton>
    </ActionForm>
  );
}

export function ReportForm({ reportId }: { reportId: string }) {
  return (
    <ActionForm action={adminReportAction} className="flex gap-1.5">
      <input type="hidden" name="reportId" value={reportId} />
      <SubmitButton size="sm" variant="danger" name="action" value="hide">Hide review</SubmitButton>
      <SubmitButton size="sm" variant="secondary" name="action" value="dismiss">Dismiss</SubmitButton>
    </ActionForm>
  );
}

export function DisputeAdminForm({ disputeId, status, resolution }: { disputeId: string; status: string; resolution: string | null }) {
  return (
    <ActionForm action={adminDisputeAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="disputeId" value={disputeId} />
      <select name="status" defaultValue={status} className={small + " sm:w-40"}>
        {["open", "investigating", "resolved", "dismissed"].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <input name="resolution" defaultValue={resolution ?? ""} placeholder="Resolution note (sent to reporter)" className={small} />
      <SubmitButton size="sm">Update</SubmitButton>
    </ActionForm>
  );
}

export function PayoutAdminForm({ payoutId, status }: { payoutId: string; status: string }) {
  if (status === "paid" || status === "failed") return null;
  return (
    <ActionForm action={adminPayoutAction} className="flex flex-wrap gap-1.5">
      <input type="hidden" name="payoutId" value={payoutId} />
      <input name="providerRef" placeholder="UTR / transfer ref" className={small + " w-40"} />
      {status === "requested" && <SubmitButton size="sm" variant="secondary" name="status" value="processing">Processing</SubmitButton>}
      <SubmitButton size="sm" name="status" value="paid">Mark transferred</SubmitButton>
      <SubmitButton size="sm" variant="danger" name="status" value="failed">Failed</SubmitButton>
    </ActionForm>
  );
}
