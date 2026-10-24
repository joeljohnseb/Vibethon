"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./action-form";
import { sandboxPayAction } from "@/app/actions/bookings";
import { cn } from "@/lib/utils";

export function SandboxCheckout({ orderId }: { orderId: string }) {
  const [method, setMethod] = useState("upi");
  return (
    <ActionForm action={sandboxPayAction} className="mt-6 space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="method" value={method} />
      <div className="grid grid-cols-3 gap-2 text-sm">
        {[["upi", "UPI"], ["card", "Card"], ["netbanking", "Net banking"]].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setMethod(v)} className={cn("rounded-xl border py-2.5 font-medium", method === v ? "border-volt bg-volt/10 text-volt" : "border-line bg-surface-2 text-muted")}>
            {l}
          </button>
        ))}
      </div>
      <SubmitButton full size="lg" name="outcome" value="success" pendingText="Processing…">Simulate successful payment</SubmitButton>
      <div className="grid grid-cols-2 gap-2">
        <SubmitButton variant="danger" name="outcome" value="failure">Simulate failure</SubmitButton>
        <SubmitButton variant="secondary" name="outcome" value="pending">Simulate pending</SubmitButton>
      </div>
    </ActionForm>
  );
}
