"use client";

import { ActionForm } from "./action-form";
import { ConfirmButton } from "./confirm-button";
import { inputClass } from "./ui";
import { cancelBookingAction } from "@/app/actions/bookings";
import { CANCELLATION_POLICIES } from "@/lib/constants";

export function CancelBookingForm({ bookingId, policy, late, confirmed, asTaker }: { bookingId: string; policy: keyof typeof CANCELLATION_POLICIES; late?: boolean; confirmed: boolean; asTaker?: boolean }) {
  const p = CANCELLATION_POLICIES[policy];
  return (
    <ActionForm action={cancelBookingAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-xs text-muted">
        {asTaker ? (
          <>
            {p.label} policy: {p.summary}
            {late && <span className="mt-1 block text-warn">This would be a late cancellation and will be visible to hosts.</span>}
          </>
        ) : (
          "The driver will be notified immediately. Frequent host cancellations affect your listing's ranking."
        )}
      </p>
      <input name="reason" maxLength={500} placeholder="Reason (optional)" className={inputClass + " h-10 text-sm"} />
      <ConfirmButton size="sm" confirmText="Cancel this booking?" confirmLabel="Yes, cancel">
        {confirmed ? "Cancel booking" : "Withdraw request"}
      </ConfirmButton>
    </ActionForm>
  );
}
