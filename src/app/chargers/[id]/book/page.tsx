import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserPage } from "@/lib/auth/session";
import { getPublicCharger } from "@/lib/services/search";
import { chargerSlots } from "@/lib/services/availability";
import { listVehicles } from "@/lib/services/vehicles";
import { AppError } from "@/lib/errors";
import { CANCELLATION_POLICIES, connectorLabel } from "@/lib/constants";
import { addDays, isIsoDate, localDate } from "@/lib/time";
import { formatPaise } from "@/lib/money";
import { BookingForm } from "@/components/booking-form";
import { DateStrip } from "@/components/date-strip";
import { Card, EmptyState, LinkButton, Notice } from "@/components/ui";
import { ChargerArt } from "@/components/charger-art";
import { Car } from "lucide-react";

export const metadata = { title: "Book a slot" };

export default async function BookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string; start?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUserPage(`/chargers/${id}/book${sp.date ? `?date=${sp.date}` : ""}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let c;
  try {
    c = await getPublicCharger(id, user.id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (c.isOwner || c.status !== "active") redirect(`/chargers/${id}`);

  const today = localDate(new Date(), c.timezone);
  const date = sp.date && isIsoDate(sp.date) && sp.date >= today && sp.date <= addDays(today, 30) ? sp.date : today;
  const [slots, vehicles] = await Promise.all([chargerSlots({ id: c.id, slotMinutes: c.slotMinutes, timezone: c.timezone }, date), listVehicles(user.id)]);
  const policy = CANCELLATION_POLICIES[c.cancellationPolicy];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href={`/chargers/${id}`} className="text-sm text-muted hover:text-ink">← {c.title}</Link>
      <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Book a charging slot</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {vehicles.length === 0 ? (
            <EmptyState
              icon={<Car />}
              title="Register your vehicle first"
              body="We need your EV's battery capacity and connector to check compatibility and calculate your bill."
              action={<LinkButton href={`/profile?next=${encodeURIComponent(`/chargers/${id}/book?date=${date}`)}#vehicles`}>Add a vehicle</LinkButton>}
            />
          ) : (
            <>
              <Card className="p-5">
                <div className="mb-3 text-sm font-medium">1. Choose a date</div>
                <DateStrip selected={date} hrefFor={(d) => `/chargers/${id}/book?date=${d}`} days={21} availableDays={new Set(c.rules.map((r) => r.weekday))} />
              </Card>
              <BookingForm
                chargerId={c.id}
                timezone={c.timezone}
                slotMinutes={c.slotMinutes}
                powerKw={c.powerKw}
                pricePerKwhPaise={c.pricePerKwhPaise}
                connectors={c.connectors}
                bookingMode={c.bookingMode}
                initialStart={sp.start}
                slots={slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), available: s.available }))}
                vehicles={vehicles.map((v) => ({
                  id: v.id,
                  label: `${v.name} · ${v.model}`,
                  batteryKwh: v.batteryKwh,
                  compatible: v.connectors.some((k) => c.connectors.includes(k)),
                  isDefault: v.isDefault,
                }))}
              />
            </>
          )}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden">
            <div className="aspect-[16/9] bg-surface-2">
              {c.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photos[0].url} alt="" className="size-full object-cover" />
              ) : (
                <ChargerArt seed={c.id} className="size-full" />
              )}
            </div>
            <div className="p-4">
              <div className="font-display font-semibold">{c.title}</div>
              <div className="text-sm text-muted">{c.locality}, {c.city}</div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted">Agreed price</span><span className="font-medium text-volt">{formatPaise(c.pricePerKwhPaise)}/kWh</span></div>
                <div className="flex justify-between"><span className="text-muted">Power</span><span>{c.powerKw} kW</span></div>
                <div className="flex justify-between"><span className="text-muted">Connectors</span><span className="text-right">{c.connectors.map(connectorLabel).join(", ")}</span></div>
                <div className="flex justify-between"><span className="text-muted">Cancellation</span><span>{policy.label}</span></div>
              </div>
            </div>
          </Card>
          <Notice tone="neutral" title="How you'll be billed">
            Your price is locked in when you book. After charging, the host records your battery %, and you pay for the estimated energy gained — nothing is charged now.
          </Notice>
        </aside>
      </div>
    </div>
  );
}
