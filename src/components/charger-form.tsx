"use client";

import { useState } from "react";
import { Crosshair } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, useFormState } from "./action-form";
import { Card, inputClass } from "./ui";
import { PinPicker } from "./maps";
import { PhotoUploader, type Photo } from "./photo-uploader";
import { AMENITIES, CANCELLATION_POLICIES, CITY_PRESETS, CONNECTORS } from "@/lib/constants";
import { createChargerAction, updateChargerAction } from "@/app/actions/host";
import { cn } from "@/lib/utils";

export type ChargerFormValues = {
  id?: string;
  title: string;
  description: string;
  addressLine: string;
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number;
  lng: number;
  connectors: string[];
  powerKw: number | "";
  pricePerKwh: number | "";
  parkingInfo: string;
  accessInstructions: string;
  safetyInfo: string;
  amenities: string[];
  bookingMode: "approval" | "instant";
  cancellationPolicy: "flexible" | "moderate" | "strict";
  slotMinutes: number;
  photos: Photo[];
};

export const emptyCharger: ChargerFormValues = {
  title: "", description: "", addressLine: "", locality: "", city: "Bengaluru", state: "Karnataka", postalCode: "",
  lat: CITY_PRESETS[0].lat, lng: CITY_PRESETS[0].lng, connectors: ["type2"], powerKw: 7.4, pricePerKwh: 12,
  parkingInfo: "", accessInstructions: "", safetyInfo: "", amenities: [], bookingMode: "approval", cancellationPolicy: "flexible", slotMinutes: 60, photos: [],
};

function F({ name, label, hint, children, className }: { name: string; label: string; hint?: string; children: React.ReactNode; className?: string }) {
  const err = useFormState().fieldErrors?.[name];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      {children}
      {err ? <p className="text-xs text-danger">{err}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

export function ChargerForm({ initial }: { initial: ChargerFormValues }) {
  const [pos, setPos] = useState({ lat: initial.lat, lng: initial.lng });
  const [geo, setGeo] = useState<string | null>(null);
  const isEdit = Boolean(initial.id);
  const t = (k: keyof ChargerFormValues) => String(initial[k] ?? "");

  const locate = () => {
    if (!navigator.geolocation) return setGeo("Location isn't available in this browser");
    setGeo("Locating…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeo(null);
      },
      () => setGeo("Couldn't get your location — drag the pin instead"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <ActionForm action={isEdit ? updateChargerAction : createChargerAction} className="space-y-5">
      {isEdit && <input type="hidden" name="chargerId" value={initial.id} />}
      <input type="hidden" name="lat" value={pos.lat.toFixed(6)} />
      <input type="hidden" name="lng" value={pos.lng.toFixed(6)} />

      <Section title="Basics" subtitle="What drivers see first in search.">
        <F name="title" label="Listing title" hint="e.g. “Covered driveway charger, 7.4 kW”">
          <input id="title" name="title" defaultValue={t("title")} maxLength={80} className={inputClass} />
        </F>
        <F name="description" label="Description">
          <textarea id="description" name="description" defaultValue={t("description")} rows={4} maxLength={1500} placeholder="Charger make, what's nearby, anything helpful…" className={cn(inputClass, "h-auto py-2.5")} />
        </F>
        <F name="photoIds" label="Photos">
          <PhotoUploader initial={initial.photos} />
        </F>
      </Section>

      <Section title="Charger" subtitle="Drivers can only book chargers compatible with their vehicle.">
        <F name="connectors" label="Connectors">
          <div className="grid gap-2 sm:grid-cols-2">
            {CONNECTORS.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm has-[:checked]:border-volt has-[:checked]:bg-volt/5">
                <input type="checkbox" name="connectors" value={c.id} defaultChecked={initial.connectors.includes(c.id)} className="size-4 accent-[#2ee88a]" />
                {c.label}
              </label>
            ))}
          </div>
        </F>
        <div className="grid gap-4 sm:grid-cols-3">
          <F name="powerKw" label="Max power (kW)">
            <input id="powerKw" name="powerKw" type="number" step="0.1" min="0.5" max="400" defaultValue={t("powerKw")} className={inputClass} />
          </F>
          <F name="pricePerKwhPaise" label="Price (₹ per kWh)" hint="Locked in for each booking when it's made">
            <input id="pricePerKwh" name="pricePerKwh" type="number" step="0.5" min="1" max="1000" defaultValue={t("pricePerKwh")} className={inputClass} />
          </F>
          <F name="slotMinutes" label="Slot length">
            <select id="slotMinutes" name="slotMinutes" defaultValue={String(initial.slotMinutes)} className={inputClass}>
              <option value="60">60 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </F>
        </div>
      </Section>

      <Section title="Location" subtitle="Your exact address is private. Drivers see an approximate area until their booking is confirmed.">
        <div className="relative h-72 overflow-hidden rounded-xl border border-line">
          <PinPicker lat={pos.lat} lng={pos.lng} onPick={(lat, lng) => setPos({ lat, lng })} />
          <button type="button" onClick={locate} className="absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-lg bg-surface-2/95 px-3 py-2 text-sm font-medium shadow-lg hover:text-volt">
            <Crosshair size={15} /> Use my location
          </button>
        </div>
        <p className="text-xs text-faint">{geo ?? "Tap the map or drag the pin to the charger's exact spot."} ({pos.lat.toFixed(5)}, {pos.lng.toFixed(5)})</p>
        <F name="addressLine" label="Street address">
          <input id="addressLine" name="addressLine" defaultValue={t("addressLine")} autoComplete="street-address" className={inputClass} />
        </F>
        <div className="grid gap-4 sm:grid-cols-2">
          <F name="locality" label="Locality / neighbourhood" hint="Shown publicly">
            <input id="locality" name="locality" defaultValue={t("locality")} className={inputClass} />
          </F>
          <F name="city" label="City">
            <input id="city" name="city" defaultValue={t("city")} autoComplete="address-level2" className={inputClass} />
          </F>
          <F name="state" label="State">
            <input id="state" name="state" defaultValue={t("state")} autoComplete="address-level1" className={inputClass} />
          </F>
          <F name="postalCode" label="PIN code">
            <input id="postalCode" name="postalCode" defaultValue={t("postalCode")} inputMode="numeric" maxLength={6} autoComplete="postal-code" className={inputClass} />
          </F>
        </div>
      </Section>

      <Section title="Parking, access & safety">
        <F name="parkingInfo" label="Parking information" hint="Shown publicly">
          <textarea id="parkingInfo" name="parkingInfo" defaultValue={t("parkingInfo")} rows={2} maxLength={800} placeholder="Covered driveway, fits one SUV…" className={cn(inputClass, "h-auto py-2.5")} />
        </F>
        <F name="accessInstructions" label="Arrival & access instructions" hint="Only shared with drivers after you confirm their booking">
          <textarea id="accessInstructions" name="accessInstructions" defaultValue={t("accessInstructions")} rows={3} maxLength={1500} placeholder="Gate code, which bell to ring, where the cable is…" className={cn(inputClass, "h-auto py-2.5")} />
        </F>
        <F name="safetyInfo" label="Safety information">
          <textarea id="safetyInfo" name="safetyInfo" defaultValue={t("safetyInfo")} rows={2} maxLength={1500} placeholder="RCD protection, how to stop charging safely…" className={cn(inputClass, "h-auto py-2.5")} />
        </F>
        <div>
          <div className="mb-1.5 text-sm font-medium">Amenities</div>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <label key={a} className="cursor-pointer rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm text-muted has-[:checked]:border-volt has-[:checked]:text-volt">
                <input type="checkbox" name="amenities" value={a} defaultChecked={initial.amenities.includes(a)} className="sr-only" />
                {a}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Booking rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <F name="bookingMode" label="How bookings work">
            <select id="bookingMode" name="bookingMode" defaultValue={initial.bookingMode} className={inputClass}>
              <option value="approval">I approve each request (recommended)</option>
              <option value="instant">Instant booking — auto-confirm open slots</option>
            </select>
          </F>
          <F name="cancellationPolicy" label="Cancellation policy">
            <select id="cancellationPolicy" name="cancellationPolicy" defaultValue={initial.cancellationPolicy} className={inputClass}>
              {Object.entries(CANCELLATION_POLICIES).map(([k, p]) => (
                <option key={k} value={k}>{p.label} — {p.freeUntilHours}h notice</option>
              ))}
            </select>
          </F>
        </div>
      </Section>

      <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
        <div className="rounded-2xl border border-line bg-bg/90 p-2 backdrop-blur">
          <FieldError name="_" />
          <SubmitButton size="lg" pendingText="Saving…">{isEdit ? "Save changes" : "Save & set availability"}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
