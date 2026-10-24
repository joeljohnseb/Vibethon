"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Crosshair, Loader2, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { CITY_PRESETS, CONNECTORS } from "@/lib/constants";
import { inputClass } from "./ui";
import { cn } from "@/lib/utils";

type Suggestion = { label: string; lat: number; lng: number };

function useUpdateParams() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const update = (patch: Record<string, string | null | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.push(`/chargers?${next.toString()}`, { scroll: false }));
  };
  return { sp, update, pending };
}

export function LocationSearch({ label }: { label: string }) {
  const { update, pending } = useUpdateParams();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: Suggestion[] };
        setItems(data.results);
      } catch {
        setItems([]);
      }
    }, 300);
  }, [q]);

  const shown = q.trim().length < 2 ? [] : items;
  const choose = (s: Suggestion) => {
    setOpen(false);
    setQ("");
    update({ lat: s.lat.toFixed(5), lng: s.lng.toFixed(5), place: s.label.slice(0, 80) });
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return setGeoState("error");
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoState("idle");
        update({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5), place: "Your location" });
      },
      (err) => setGeoState(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={`Near ${label} — search an area, landmark or city`}
            className={cn(inputClass, "h-12 pl-11")}
            aria-label="Search location"
          />
          {pending && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-volt" />}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 text-sm font-medium text-ink hover:border-volt hover:text-volt"
          title="Use my current location"
        >
          {geoState === "asking" ? <Loader2 size={18} className="animate-spin" /> : <Crosshair size={18} />}
          <span className="hidden sm:inline">Near me</span>
        </button>
      </div>
      {geoState === "denied" && (
        <p className="mt-2 text-xs text-warn">Location permission was denied. Search for an area instead, or allow location access in your browser settings.</p>
      )}
      {geoState === "error" && <p className="mt-2 text-xs text-warn">We couldn&apos;t get your location. Search for an area instead.</p>}
      {open && (
        <div className="absolute inset-x-0 top-14 z-30 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl shadow-black/50">
          {(shown.length ? shown : CITY_PRESETS.map((c) => ({ label: c.name, lat: c.lat, lng: c.lng }))).map((s) => (
            <button
              key={`${s.label}-${s.lat}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-muted hover:bg-surface-3 hover:text-ink"
            >
              <MapPin size={14} className="shrink-0 text-faint" />
              <span className="truncate">{s.label}</span>
            </button>
          ))}
          {!shown.length && <div className="border-t border-line px-4 py-2 text-xs text-faint">Popular cities — or type to search</div>}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ vehicles }: { vehicles: { id: string; label: string }[] }) {
  const { sp, update } = useUpdateParams();
  const [open, setOpen] = useState(false);
  const active = ["price", "connector", "power", "date", "vehicle"].filter((k) => sp.get(k)).length + (sp.get("radius") && sp.get("radius") !== "10" ? 1 : 0);
  const sel = "h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink outline-none focus:border-volt";

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Search radius" className={sel} value={sp.get("radius") ?? "10"} onChange={(e) => update({ radius: e.target.value })}>
          {[2, 5, 10, 25, 50].map((r) => (
            <option key={r} value={r}>Within {r} km</option>
          ))}
        </select>
        {vehicles.length > 0 && (
          <select aria-label="Compatible with my vehicle" className={sel} value={sp.get("vehicle") ?? ""} onChange={(e) => update({ vehicle: e.target.value })}>
            <option value="">Any vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>Fits {v.label}</option>
            ))}
          </select>
        )}
        <select aria-label="Sort" className={sel} value={sp.get("sort") ?? "distance"} onChange={(e) => update({ sort: e.target.value })}>
          <option value="distance">Nearest</option>
          <option value="price">Cheapest</option>
          <option value="rating">Top rated</option>
        </select>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn("flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium", open || active ? "border-volt text-volt" : "border-line text-ink")}
          aria-expanded={open}
        >
          <SlidersHorizontal size={15} /> Filters {active > 0 && <span className="rounded-full bg-volt px-1.5 text-xs text-volt-ink">{active}</span>}
        </button>
        {active > 0 && (
          <button type="button" onClick={() => update({ price: null, connector: null, power: null, date: null, from: null, to: null, vehicle: null, radius: null })} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
            <X size={14} /> Clear
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Max price (₹/kWh)</span>
            <input type="number" min={1} step={0.5} defaultValue={sp.get("price") ?? ""} placeholder="Any" className={sel} onBlur={(e) => update({ price: e.target.value })} onKeyDown={(e) => e.key === "Enter" && update({ price: (e.target as HTMLInputElement).value })} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Connector</span>
            <select className={sel} value={sp.get("connector") ?? ""} onChange={(e) => update({ connector: e.target.value })}>
              <option value="">Any</option>
              {CONNECTORS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Charging speed</span>
            <select className={sel} value={sp.get("power") ?? ""} onChange={(e) => update({ power: e.target.value })}>
              <option value="">Any</option>
              <option value="3">3 kW+ (slow AC)</option>
              <option value="7">7 kW+ (fast AC)</option>
              <option value="11">11 kW+</option>
              <option value="22">22 kW+ (DC)</option>
            </select>
          </label>
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Available on</span>
            <div className="flex gap-2">
              <input type="date" aria-label="Date" className={cn(sel, "flex-1")} defaultValue={sp.get("date") ?? ""} onChange={(e) => update({ date: e.target.value })} />
            </div>
            {sp.get("date") && (
              <div className="flex items-center gap-2">
                <input type="time" aria-label="From" step={1800} className={cn(sel, "flex-1")} defaultValue={sp.get("from") ?? ""} onChange={(e) => update({ from: e.target.value })} />
                <span className="text-faint">–</span>
                <input type="time" aria-label="To" step={1800} className={cn(sel, "flex-1")} defaultValue={sp.get("to") ?? ""} onChange={(e) => update({ to: e.target.value })} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ViewToggle({ list, map }: { list: React.ReactNode; map: React.ReactNode }) {
  const [view, setView] = useState<"list" | "map">("list");
  return (
    <>
      <div className="mb-3 grid grid-cols-2 rounded-xl border border-line bg-surface p-1 text-sm lg:hidden">
        {(["list", "map"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn("rounded-lg py-2 font-medium capitalize", view === v ? "bg-surface-3 text-ink" : "text-muted")}>
            {v}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className={cn("min-w-0", view === "map" && "hidden lg:block")}>{list}</div>
        <div className={cn("lg:sticky lg:top-20 lg:block lg:h-[calc(100dvh-6rem)]", view === "list" ? "hidden" : "h-[65dvh]")}>{map}</div>
      </div>
    </>
  );
}
