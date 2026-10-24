"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./action-form";
import { inputClass } from "./ui";
import { addBlockAction, removeBlockAction } from "@/app/actions/host";

export function AddBlockForm({ chargerId, today }: { chargerId: string; today: string }) {
  const [allDay, setAllDay] = useState(true);
  return (
    <ActionForm action={addBlockAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="chargerId" value={chargerId} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">From date</span>
        <input type="date" name="date" min={today} defaultValue={today} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">To date</span>
        <input type="date" name="endDate" min={today} defaultValue={today} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[#2ee88a]" /> All day
      </label>
      {!allDay && (
        <>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">From time</span><input type="time" name="from" step={1800} defaultValue="09:00" className={inputClass} /></label>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">To time</span><input type="time" name="to" step={1800} defaultValue="17:00" className={inputClass} /></label>
        </>
      )}
      <input name="reason" maxLength={200} placeholder="Reason (private, optional)" className={inputClass + " sm:col-span-2"} />
      <div className="sm:col-span-2"><SubmitButton variant="secondary" pendingText="Blocking…">Block this time</SubmitButton></div>
    </ActionForm>
  );
}

export function RemoveBlockButton({ chargerId, blockId }: { chargerId: string; blockId: string }) {
  return (
    <ActionForm action={removeBlockAction} showMessage={false}>
      <input type="hidden" name="chargerId" value={chargerId} />
      <input type="hidden" name="blockId" value={blockId} />
      <button aria-label="Remove block" className="grid size-8 place-items-center rounded-lg text-faint hover:text-danger"><Trash2 size={15} /></button>
    </ActionForm>
  );
}
