"use client";

import { useState } from "react";
import { BatteryCharging, BatteryFull, KeyRound } from "lucide-react";
import { ActionForm, FieldError, SubmitButton } from "./action-form";
import { inputClass } from "./ui";
import { endReadingAction, startReadingAction, verifyCodeAction } from "@/app/actions/host";
import { cn } from "@/lib/utils";

export function VerifyCodeForm({ bookingId }: { bookingId: string }) {
  return (
    <ActionForm action={verifyCodeAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-2 text-sm font-medium"><KeyRound size={16} className="text-volt" /> Driver&apos;s start code</div>
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="000 000"
        className={cn(inputClass, "h-16 text-center font-mono text-3xl tracking-[0.4em]")}
        aria-label="6-digit code"
      />
      <FieldError name="code" />
      <p className="text-xs text-faint">Ask the driver to open their booking and tap “Show my start code”. Codes expire after 10 minutes and lock after 5 wrong attempts.</p>
      <SubmitButton full size="lg" pendingText="Verifying…">Verify code</SubmitButton>
    </ActionForm>
  );
}

function PercentInput({ min = 0, label }: { min?: number; label: string }) {
  const [v, setV] = useState<number | "">("");
  return (
    <div>
      <label htmlFor="percent" className="text-sm font-medium">{label}</label>
      <div className="mt-2 flex items-center gap-3">
        <input
          id="percent"
          name="percent"
          type="number"
          inputMode="numeric"
          min={min}
          max={100}
          step={1}
          value={v}
          onChange={(e) => setV(e.target.value === "" ? "" : Math.max(0, Math.min(100, Math.round(Number(e.target.value)))))}
          className={cn(inputClass, "h-16 w-32 text-center font-display text-3xl font-semibold")}
        />
        <span className="font-display text-3xl text-faint">%</span>
        <div className="h-10 flex-1 overflow-hidden rounded-lg border border-line bg-surface-2 p-1">
          <div className="h-full rounded bg-gradient-to-r from-volt/60 to-volt transition-all" style={{ width: `${v === "" ? 0 : v}%` }} />
        </div>
      </div>
      <FieldError name="percent" />
    </div>
  );
}

export function StartReadingForm({ bookingId }: { bookingId: string }) {
  return (
    <ActionForm action={startReadingAction} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-2 text-sm text-volt"><BatteryCharging size={16} /> Code verified</div>
      <PercentInput label="Vehicle's battery % right now (from the car's dashboard)" />
      <SubmitButton full size="lg" pendingText="Starting…">Record start & begin charging</SubmitButton>
    </ActionForm>
  );
}

export function EndReadingForm({ bookingId, startPercent, batteryKwh, pricePaise }: { bookingId: string; startPercent: number; batteryKwh: number; pricePaise: number }) {
  return (
    <ActionForm action={endReadingAction} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex items-center gap-2 text-sm font-medium"><BatteryFull size={16} className="text-volt" /> Finish session</div>
      <PercentInput min={startPercent} label={`Battery % at the end (started at ${startPercent}%)`} />
      <p className="text-xs text-faint">
        Eber calculates the bill: {batteryKwh} kWh × (end % − {startPercent}%) × ₹{(pricePaise / 100).toFixed(2)}/kWh. The driver sees the same breakdown before paying.
      </p>
      <SubmitButton full size="lg" pendingText="Calculating bill…">Record end & send bill</SubmitButton>
    </ActionForm>
  );
}
