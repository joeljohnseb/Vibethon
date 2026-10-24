"use client";

import { useState } from "react";
import { BadgeCheck, Pencil, Star, Trash2 } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, useFormState } from "./action-form";
import { ConfirmButton } from "./confirm-button";
import { Badge, inputClass, Notice } from "./ui";
import { addVehicleAction, confirmPhoneOtpAction, deleteVehicleAction, sendPhoneOtpAction, updateProfileAction, updateVehicleAction } from "@/app/actions/account";
import { CONNECTORS, connectorLabel } from "@/lib/constants";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";

function Text({ name, label, defaultValue, placeholder, type = "text", step, inputMode }: { name: string; label: string; defaultValue?: string | number; placeholder?: string; type?: string; step?: string; inputMode?: "numeric" | "decimal" | "tel" }) {
  const err = useFormState().fieldErrors?.[name];
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <input name={name} type={type} step={step} inputMode={inputMode} defaultValue={defaultValue} placeholder={placeholder} aria-invalid={err ? true : undefined} className={inputClass} />
      <FieldError name={name} />
    </label>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string | null }) {
  return (
    <ActionForm action={updateProfileAction} className="space-y-4">
      <Text name="name" label="Full name" defaultValue={name} />
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <input value={email ?? "—"} disabled className={inputClass + " opacity-60"} />
      </div>
      <SubmitButton variant="secondary">Save profile</SubmitButton>
    </ActionForm>
  );
}

export function PhoneVerification({ phone, verified, sandbox }: { phone: string | null; verified: boolean; sandbox: boolean }) {
  const [step, setStep] = useState<{ phone: string; sandboxCode: string | null } | null>(null);
  const [editing, setEditing] = useState(!verified);
  if (verified && !editing)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{phone}</span>
          <Badge tone="volt"><BadgeCheck size={12} /> Verified</Badge>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-muted hover:text-ink">Change number</button>
      </div>
    );
  if (!step)
    return (
      <ActionForm action={sendPhoneOtpAction} className="space-y-3" onSuccess={(s: ActionState) => setStep(s.data as { phone: string; sandboxCode: string | null })} showMessage>
        <Text name="phone" label="Mobile number" type="tel" inputMode="tel" defaultValue={phone ?? ""} placeholder="98765 43210" />
        <p className="text-xs text-faint">We&apos;ll text you a 6-digit code. Hosts must verify a phone before publishing; drivers&apos; numbers are shared only with their confirmed host.{sandbox && " Test mode: the code is shown on screen."}</p>
        <SubmitButton pendingText="Sending…">Send verification code</SubmitButton>
      </ActionForm>
    );
  return (
    <ActionForm action={confirmPhoneOtpAction} className="space-y-3" onSuccess={() => { setStep(null); setEditing(false); }}>
      <input type="hidden" name="phone" value={step.phone} />
      {step.sandboxCode && <Notice tone="warn" title="Test mode SMS">Your code is <span className="font-mono font-bold tracking-widest">{step.sandboxCode}</span></Notice>}
      <Text name="code" label={`Code sent to ${step.phone}`} inputMode="numeric" placeholder="••••••" />
      <div className="flex gap-2">
        <SubmitButton pendingText="Verifying…">Verify</SubmitButton>
        <button type="button" onClick={() => setStep(null)} className="text-sm text-muted">Change number</button>
      </div>
    </ActionForm>
  );
}

type V = { id: string; name: string; model: string; batteryKwh: number; connectors: string[]; isDefault: boolean };

function VehicleFields({ v }: { v?: V }) {
  const err = useFormState().fieldErrors?.connectors;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text name="name" label="Nickname" defaultValue={v?.name} placeholder="Daily driver" />
        <Text name="model" label="Make & model" defaultValue={v?.model} placeholder="Tata Nexon EV" />
      </div>
      <Text name="batteryKwh" label="Usable battery capacity (kWh)" type="number" step="0.1" inputMode="decimal" defaultValue={v?.batteryKwh} placeholder="40.5" />
      <p className="-mt-2 text-xs text-faint">Used to calculate your bill: capacity × battery % gained. Find it in your car&apos;s manual or spec sheet.</p>
      <div>
        <div className="mb-1.5 text-sm font-medium">Connectors your car can use</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONNECTORS.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm has-[:checked]:border-volt has-[:checked]:bg-volt/5">
              <input type="checkbox" name="connectors" value={c.id} defaultChecked={v ? v.connectors.includes(c.id) : c.id === "type2"} className="size-4 accent-[#2ee88a]" />
              {c.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-faint">Most Indian EVs with a CCS2 inlet also accept Type 2 AC charging.</p>
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked={v?.isDefault} className="size-4 accent-[#2ee88a]" /> Use as my default vehicle
      </label>
    </div>
  );
}

export function AddVehicleForm({ open: initialOpen }: { open?: boolean }) {
  const [open, setOpen] = useState(Boolean(initialOpen));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-2xl border border-dashed border-line-strong py-4 text-sm font-medium text-muted hover:border-volt hover:text-volt">
        + Add a vehicle
      </button>
    );
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 font-display font-semibold">New vehicle</div>
      <ActionForm action={addVehicleAction} resetOnSuccess onSuccess={() => setOpen(false)}>
        <VehicleFields />
        <div className="mt-5 flex gap-2">
          <SubmitButton pendingText="Saving…">Save vehicle</SubmitButton>
          <button type="button" onClick={() => setOpen(false)} className="px-3 text-sm text-muted">Cancel</button>
        </div>
      </ActionForm>
    </div>
  );
}

export function VehicleCard({ v }: { v: V }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <div className="rounded-2xl border border-volt/40 bg-surface p-5">
        <ActionForm action={updateVehicleAction} onSuccess={() => setEditing(false)}>
          <input type="hidden" name="vehicleId" value={v.id} />
          <VehicleFields v={v} />
          <div className="mt-5 flex gap-2">
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="px-3 text-sm text-muted">Cancel</button>
          </div>
        </ActionForm>
      </div>
    );
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border bg-surface p-4 sm:flex-row sm:items-center", v.isDefault ? "border-volt/40" : "border-line")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{v.model}</span>
          {v.isDefault && <Badge tone="volt"><Star size={11} /> Default</Badge>}
        </div>
        <div className="text-sm text-muted">{v.name} · {v.batteryKwh} kWh · {v.connectors.map(connectorLabel).join(", ")}</div>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setEditing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-ink"><Pencil size={14} /> Edit</button>
        <ActionForm action={deleteVehicleAction} showMessage={false}>
          <input type="hidden" name="vehicleId" value={v.id} />
          <ConfirmButton size="sm" variant="secondary" confirmText="Remove?" confirmLabel="Remove"><Trash2 size={14} /></ConfirmButton>
        </ActionForm>
      </div>
    </div>
  );
}
