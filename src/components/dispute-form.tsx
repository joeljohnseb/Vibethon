"use client";

import { ActionForm, FieldError, SubmitButton } from "./action-form";
import { inputClass } from "./ui";
import { disputeAction } from "@/app/actions/bookings";
import { cn } from "@/lib/utils";

export function DisputeForm({ categories, bookingRef }: { categories: Record<string, string>; bookingRef?: string }) {
  return (
    <ActionForm action={disputeAction} resetOnSuccess className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Booking reference (optional)</span>
          <input name="bookingRef" defaultValue={bookingRef} placeholder="EBR-XXXXXX" className={cn(inputClass, "uppercase")} />
          <FieldError name="bookingRef" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">What&apos;s it about?</span>
          <select name="category" defaultValue="" className={inputClass}>
            <option value="" disabled>Choose a category</option>
            {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <FieldError name="category" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Describe what happened</span>
        <textarea name="description" rows={5} maxLength={4000} placeholder="Include times, battery readings, and anything else that helps us investigate." className={cn(inputClass, "h-auto py-2.5")} />
        <FieldError name="description" />
      </label>
      <SubmitButton pendingText="Submitting…">Submit report</SubmitButton>
    </ActionForm>
  );
}
