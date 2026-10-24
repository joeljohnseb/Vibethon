"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock, Minus, Plus } from "lucide-react";
import { ActionForm, SubmitButton } from "./action-form";
import { Card, inputClass, Notice } from "./ui";
import { cn } from "@/lib/utils";
import { createBookingAction } from "@/app/actions/bookings";
import { formatPaise } from "@/lib/money";
import { MAX_BOOKING_SLOTS } from "@/lib/constants";

type SlotDTO = { start: string; end: string; available: boolean };
type VehicleDTO = { id: string; label: string; batteryKwh: number; compatible: boolean; isDefault: boolean };

const fmt = (iso: string, tz: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });

export function BookingForm(props: {
  chargerId: string;
  timezone: string;
  slotMinutes: number;
  powerKw: number;
  pricePerKwhPaise: number;
  connectors: string[];
  bookingMode: "approval" | "instant";
  slots: SlotDTO[];
  vehicles: VehicleDTO[];
  initialStart?: string;
}) {
  const { slots, timezone, slotMinutes } = props;
  const initialIdx = slots.findIndex((s) => s.start === props.initialStart && s.available);
  const [startIdx, setStartIdx] = useState(initialIdx >= 0 ? initialIdx : -1);
  const [count, setCount] = useState(1);
  const firstCompat = props.vehicles.find((v) => v.compatible && v.isDefault) ?? props.vehicles.find((v) => v.compatible);
  const [vehicleId, setVehicleId] = useState(firstCompat?.id ?? "");
  const [idem] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())));

  // How many consecutive available slots from the chosen start?
  const maxCount = useMemo(() => {
    if (startIdx < 0) return 1;
    let n = 0;
    for (let i = startIdx; i < slots.length && n < MAX_BOOKING_SLOTS; i++) {
      if (!slots[i].available) break;
      if (i > startIdx && slots[i].start !== slots[i - 1].end) break;
      n++;
    }
    return Math.max(n, 1);
  }, [startIdx, slots]);
  const n = Math.min(count, maxCount);
  const vehicle = props.vehicles.find((v) => v.id === vehicleId);
  const hours = (n * slotMinutes) / 60;
  const start = startIdx >= 0 ? slots[startIdx] : null;
  const end = start ? slots[startIdx + n - 1]?.end : null;

  // Estimates (for guidance only — the real bill is computed from recorded battery %).
  const per10 = vehicle ? Math.round(vehicle.batteryKwh * 0.1 * props.pricePerKwhPaise) : 0;
  const maxKwh = vehicle ? Math.min(props.powerKw * hours, vehicle.batteryKwh * 0.8) : 0;
  const maxCost = Math.round(maxKwh * props.pricePerKwhPaise);

  return (
    <ActionForm action={createBookingAction} className="mt-4 space-y-4">
      <input type="hidden" name="chargerId" value={props.chargerId} />
      <input type="hidden" name="startAt" value={start?.start ?? ""} />
      <input type="hidden" name="slotCount" value={n} />
      <input type="hidden" name="idempotencyKey" value={idem} />

      <Card className="p-5">
        <div className="mb-3 text-sm font-medium">2. Choose a start time</div>
        {slots.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-3 py-6 text-center text-sm text-faint">The host isn&apos;t available on this day. Pick another date.</p>
        ) : slots.every((s) => !s.available) ? (
          <p className="rounded-xl bg-surface-2 px-3 py-6 text-center text-sm text-faint">Fully booked on this day. Pick another date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {slots.map((s, i) => {
              const inRange = startIdx >= 0 && i >= startIdx && i < startIdx + n;
              return (
                <button
                  type="button"
                  key={s.start}
                  disabled={!s.available}
                  onClick={() => {
                    setStartIdx(i);
                    setCount(1);
                  }}
                  className={cn(
                    "rounded-lg border py-2.5 text-sm font-medium transition",
                    !s.available && "cursor-not-allowed border-line/50 text-faint line-through decoration-line-strong",
                    s.available && !inRange && "border-line bg-surface-2 hover:border-volt",
                    inRange && "border-volt bg-volt text-volt-ink",
                  )}
                >
                  {fmt(s.start, timezone)}
                </button>
              );
            })}
          </div>
        )}

        {start && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-2 p-4">
            <div>
              <div className="text-xs text-faint">Duration</div>
              <div className="mt-0.5 flex items-center gap-2 font-medium">
                <Clock size={15} className="text-volt" /> {fmt(start.start, timezone)} – {end && fmt(end, timezone)} · {hours} h
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Shorter" disabled={n <= 1} onClick={() => setCount(n - 1)} className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-40">
                <Minus size={16} />
              </button>
              <span className="w-16 text-center text-sm font-medium">{n} slot{n > 1 ? "s" : ""}</span>
              <button type="button" aria-label="Longer" disabled={n >= maxCount} onClick={() => setCount(n + 1)} className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-40">
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 text-sm font-medium">3. Choose your vehicle</div>
        <div className="space-y-2">
          {props.vehicles.map((v) => (
            <label
              key={v.id}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition",
                !v.compatible && "cursor-not-allowed opacity-50",
                vehicleId === v.id ? "border-volt bg-volt/5" : "border-line bg-surface-2",
              )}
            >
              <span className="flex items-center gap-3">
                <input type="radio" name="vehicleId" value={v.id} disabled={!v.compatible} checked={vehicleId === v.id} onChange={() => setVehicleId(v.id)} className="size-4 accent-[#2ee88a]" />
                <span>
                  <span className="block font-medium">{v.label}</span>
                  <span className="text-xs text-muted">{v.batteryKwh} kWh battery</span>
                </span>
              </span>
              {!v.compatible && <span className="text-xs text-warn">Incompatible connector</span>}
            </label>
          ))}
        </div>
        <Link href="/profile#vehicles" className="mt-3 inline-block text-sm text-volt hover:underline">+ Add another vehicle</Link>
      </Card>

      <Card className="p-5">
        <div className="mb-3 text-sm font-medium">4. Note for the host (optional)</div>
        <textarea name="note" rows={2} maxLength={500} placeholder="e.g. arriving from the main road, white SUV" className={cn(inputClass, "h-auto py-2.5")} />
      </Card>

      {vehicle && start && (
        <Card className="p-5">
          <div className="text-sm font-medium">Cost estimate</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="text-xs text-faint">Every 10% of your battery</div>
              <div className="mt-1 font-display text-xl font-semibold">{formatPaise(per10)}</div>
              <div className="text-xs text-muted">{(vehicle.batteryKwh * 0.1).toFixed(2)} kWh × {formatPaise(props.pricePerKwhPaise)}</div>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="text-xs text-faint">Most you could use in {hours} h</div>
              <div className="mt-1 font-display text-xl font-semibold">≈ {formatPaise(maxCost)}</div>
              <div className="text-xs text-muted">≈ {maxKwh.toFixed(1)} kWh at {props.powerKw} kW (capped at 80% of battery)</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-faint">
            Your final bill = {vehicle.batteryKwh} kWh × (end % − start %) × {formatPaise(props.pricePerKwhPaise)}/kWh, calculated by Eber from the readings the host records. Any configured fees are shown separately before you pay.
          </p>
        </Card>
      )}

      {!firstCompat && <Notice tone="warn">None of your vehicles can use this charger&apos;s connectors.</Notice>}
      <SubmitButton size="lg" full disabled={!start || !vehicle?.compatible} pendingText="Sending request…">
        {props.bookingMode === "instant" ? "Confirm booking" : "Request booking"}
      </SubmitButton>
      <p className="text-center text-xs text-faint">
        {props.bookingMode === "instant" ? "This host accepts instant bookings — your slot is reserved immediately." : "The host will approve or decline your request. You'll be notified either way."} Nothing is charged until after your session.
      </p>
    </ActionForm>
  );
}
