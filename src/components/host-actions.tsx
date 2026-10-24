"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { ActionForm, SubmitButton } from "./action-form";
import { inputClass } from "./ui";
import { decideBookingAction } from "@/app/actions/host";

export function DecisionButtons({ bookingId, withNote }: { bookingId: string; withNote?: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  return (
    <ActionForm action={decideBookingAction} className="flex flex-col gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      {(withNote || rejecting) && <input name="note" maxLength={500} placeholder={rejecting ? "Reason for declining (shared with driver)" : "Optional note to the driver"} className={inputClass + " h-10 text-sm"} />}
      <div className="flex gap-2">
        {rejecting ? (
          <>
            <SubmitButton variant="danger" size="sm" name="decision" value="reject">Decline request</SubmitButton>
            <button type="button" onClick={() => setRejecting(false)} className="text-sm text-muted">Back</button>
          </>
        ) : (
          <>
            <SubmitButton size="sm" name="decision" value="approve" pendingText="Approving…"><Check size={15} /> Approve</SubmitButton>
            <button type="button" onClick={() => setRejecting(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-muted hover:text-danger"><X size={15} /> Decline</button>
          </>
        )}
      </div>
    </ActionForm>
  );
}
