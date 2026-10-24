"use client";

import { useState } from "react";
import { Crosshair, MapPin } from "lucide-react";
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
  const isEdit = Boolean(initial.id);
  const [pos, setPos] = useState({ lat: initial.lat, lng: initial.lng });
  // Where the pin came from. A new listing starts at a placeholder ("default") and can't be saved until placed.
  const [pinSource, setPinSource] = useState<"default" | "saved" | "address" | "gps" | "manual">(isEdit ? "saved" : "default");
  const [geo, setGeo] = useState<{ tone: "muted" | "warn" | "volt"; text: string } | null>(null);
  const t = (k: keyof ChargerFormValues) => String(initial[k] ?? "");

  const place = (lat: number, lng: number, source: typeof pinSource) => {
    setPos({ lat, lng });
    setPinSource(source);
  };

  const locate = () => {
    if (!navigator.geolocation) return setGeo({ tone: "warn", text: "Location isn't available in this browser — find your address instead" });
    setGeo({ tone: "muted", text: "Locating…" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        place(p.coords.latitude, p.coords.longitude, "gps");
        setGeo({ tone: "volt", text: "Pin set to your current location. Drag it if the charger is elsewhere." });
      },
      () => setGeo({ tone: "warn", text: "Couldn't get your location — find your address or drag the pin instead" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  /** Look up the typed address and move the pin there (most specific match first). */
  const findAddress = async (auto = false) => {
    if (auto && (pinSource === "manual" || pinSource === "gps" || pinSource === "saved")) return;
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? "";
    const [line, loc, city, state, pin] = ["addressLine", "locality", "city", "state", "postalCode"].map(v);
    const queries = [
      [line, loc, city, state, pin],
      [line, city, state],
      [loc, city, state, pin],
      [loc, city, state],
      [pin],
      [city, state],
    ]
      .map((q) => q.filter(Boolean).join(", "))
      .filter((q, i, all) => q.length > 2 && all.indexOf(q) === i);
    if (!queries.length) return !auto && setGeo({ tone: "warn", text: "Enter the address first." });
    setGeo({ tone: "muted", text: "Finding your address…" });
    for (const q of queries) {
      try {
        const res = await fetch(`/api/geocode?presets=0&q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: { lat: number; lng: number; label: string }[] };
        if (data.results[0]) {
          place(data.results[0].lat, data.results[0].lng, "address");
          setGeo({ tone: "volt", text: `Pin moved to “${data.results[0].label}”. Drag it onto the exact charger spot if needed.` });
          return;
        }
      } catch {
        break;
      }
    }
    setGeo({ tone: "warn", text: "We couldn't find that address on the map. Drag the pin to your charger or use your location." });
  };

  return (
    <ActionForm action={isEdit ? updateChargerAction : createChargerAction} className="space-y-5">
      {isEdit && <input type="hidden" name="chargerId" value={initial.id} />}
      <input type="hidden" name="lat" value={pos.lat.toFixed(6)} />
      <input type="hidden" name="lng" value={pos.lng.toFixed(6)} />
      <input type="hidden" name="pinSet" value={pinSource === "default" ? "" : "1"} />

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

      <Section title="Location" subtitle="Your exact address is private. Drivers see an approximate area until their booking is confirmed, then get directions to this pin.">
        <F name="addressLine" label="Street address">
          <input id="addressLine" name="addressLine" defaultValue={t("addressLine")} autoComplete="street-address" onBlur={() => findAddress(true)} className={inputClass} />
        </F>
        <div className="grid gap-4 sm:grid-cols-2">
          <F name="locality" label="Locality / neighbourhood" hint="Shown publicly">
            <input id="locality" name="locality" defaultValue={t("locality")} onBlur={() => findAddress(true)} className={inputClass} />
          </F>
          <F name="city" label="City">
            <input id="city" name="city" defaultValue={t("city")} autoComplete="address-level2" onBlur={() => findAddress(true)} className={inputClass} />
          </F>
          <F name="state" label="State">
            <input id="state" name="state" defaultValue={t("state")} autoComplete="address-level1" onBlur={() => findAddress(true)} className={inputClass} />
          </F>
          <F name="postalCode" label="PIN code">
            <input id="postalCode" name="postalCode" defaultValue={t("postalCode")} inputMode="numeric" maxLength={6} autoComplete="postal-code" onBlur={() => findAddress(true)} className={inputClass} />
          </F>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => findAddress(false)} className="flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-medium hover:border-volt hover:text-volt">
            <MapPin size={15} /> Find address on map
          </button>
          <button type="button" onClick={locate} className="flex h-10 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-medium hover:border-volt hover:text-volt">
            <Crosshair size={15} /> I&apos;m at the charger — use my location
          </button>
        </div>
        <div className={cn("relative h-72 overflow-hidden rounded-xl border", pinSource === "default" ? "border-warn/60" : "border-line")}>
          <PinPicker lat={pos.lat} lng={pos.lng} onPick={(lat, lng) => place(lat, lng, "manual")} />
        </div>
        <p className={cn("text-xs", geo?.tone === "warn" || (!geo && pinSource === "default") ? "text-warn" : geo?.tone === "volt" ? "text-volt" : "text-faint")}>
          {geo?.text ?? (pinSource === "default" ? "Place the pin on your charger: find your address, use your location, or tap the map." : "Drag the pin or tap the map to fine-tune the charger's exact spot.")}{" "}
          <span className="text-faint">({pos.lat.toFixed(5)}, {pos.lng.toFixed(5)})</span>
        </p>
        <FieldError name="lat" />
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
