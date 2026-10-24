import { Suspense } from "react";
import { BatteryWarning, MapPinOff } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { searchChargers } from "@/lib/services/search";
import { listVehicles } from "@/lib/services/vehicles";
import { CITY_PRESETS } from "@/lib/constants";
import { hhmmToMinutes, isIsoDate } from "@/lib/time";
import { ChargerCard } from "@/components/charger-card";
import { FilterBar, LocationSearch, ViewToggle } from "@/components/search-controls";
import { ResultsMap } from "@/components/maps";
import { EmptyState, LinkButton } from "@/components/ui";
import { formatPaise } from "@/lib/money";

export const metadata = { title: "Find a charger" };

type SP = Record<string, string | undefined>;

export default async function ChargersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && sp.lat && sp.lng;
  const center = hasLoc ? { lat, lng } : { lat: CITY_PRESETS[0].lat, lng: CITY_PRESETS[0].lng };
  const place = hasLoc ? (sp.place ?? "selected location") : "Bengaluru";
  const vehicles = user ? await listVehicles(user.id) : [];
  const date = sp.date && isIsoDate(sp.date) ? sp.date : undefined;
  const from = sp.from ? hhmmToMinutes(sp.from) : NaN;
  const to = sp.to ? hhmmToMinutes(sp.to) : NaN;

  const { results, radiusKm } = await searchChargers({
    lat: center.lat,
    lng: center.lng,
    radiusKm: sp.radius ? Number(sp.radius) : undefined,
    maxPricePaise: sp.price ? Math.round(Number(sp.price) * 100) || undefined : undefined,
    connectors: sp.connector ? [sp.connector] : undefined,
    minPowerKw: sp.power ? Number(sp.power) || undefined : undefined,
    date,
    fromMinute: date && Number.isFinite(from) ? from : undefined,
    toMinute: date && Number.isFinite(to) ? to : undefined,
    vehicleId: sp.vehicle,
    viewerId: user?.id,
    sort: (sp.sort as "distance" | "price" | "rating") ?? "distance",
  });

  const keep = new URLSearchParams();
  if (date) keep.set("date", date);
  if (sp.vehicle) keep.set("vehicle", sp.vehicle);
  const query = keep.toString();

  const list = results.length ? (
    <div className="space-y-3">
      {results.map((c) => (
        <ChargerCard key={c.id} c={c} query={query} />
      ))}
      <p className="pt-2 text-center text-xs text-faint">Pins show approximate locations. The exact address is shared once your booking is confirmed.</p>
    </div>
  ) : (
    <EmptyState
      icon={date ? <BatteryWarning /> : <MapPinOff />}
      title={date ? "No open slots match those filters" : `No home chargers within ${radiusKm} km`}
      body={date ? "Try another date or time window, or widen the search radius." : "Try a larger radius or another area. Eber is growing — new hosts join every week."}
      action={
        <LinkButton href={`/chargers?${new URLSearchParams({ ...(hasLoc ? { lat: String(lat), lng: String(lng), place } : {}), radius: "50" })}`} variant="secondary">
          Search within 50 km
        </LinkButton>
      }
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Home chargers near {place}</h1>
        <p className="mt-1 text-sm text-muted">
          {results.length} found within {radiusKm} km
          {!hasLoc && " · tap “Near me” to use your current location"}
        </p>
      </div>
      <Suspense>
        <LocationSearch label={place} />
        <FilterBar vehicles={vehicles.map((v) => ({ id: v.id, label: v.model }))} />
      </Suspense>
      <div className="mt-5">
        <ViewToggle
          list={list}
          map={
            <div className="size-full overflow-hidden rounded-2xl border border-line">
              <ResultsMap
                center={[center.lat, center.lng]}
                radiusKm={radiusKm}
                query={query}
                points={results.map((r) => ({ id: r.id, lat: r.approx.lat, lng: r.approx.lng, label: formatPaise(r.pricePerKwhPaise, { short: true }), muted: !r.available }))}
              />
            </div>
          }
        />
      </div>
    </div>
  );
}
