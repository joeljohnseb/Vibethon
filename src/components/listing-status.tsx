"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { ConfirmButton } from "./confirm-button";
import { setChargerStatusAction } from "@/app/actions/host";

export function ListingStatusControls({ chargerId, status, showRemove }: { chargerId: string; status: string; showRemove?: boolean }) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status !== "active" ? (
          <ActionForm action={setChargerStatusAction}>
            <input type="hidden" name="chargerId" value={chargerId} />
            <input type="hidden" name="status" value="active" />
            <SubmitButton size="sm" pendingText="Publishing…">{status === "draft" ? "Publish listing" : "Resume listing"}</SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm action={setChargerStatusAction}>
            <input type="hidden" name="chargerId" value={chargerId} />
            <input type="hidden" name="status" value="paused" />
            <SubmitButton size="sm" variant="secondary" pendingText="Pausing…">Pause</SubmitButton>
          </ActionForm>
        )}
        {showRemove && (
          <ActionForm action={setChargerStatusAction}>
            <input type="hidden" name="chargerId" value={chargerId} />
            <input type="hidden" name="status" value="removed" />
            <ConfirmButton size="sm" confirmText="Remove this listing permanently?" confirmLabel="Remove">Remove</ConfirmButton>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
