import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, CalendarClock, Car, Info, Lock, MapPin, ParkingCircle, ShieldCheck, Zap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicCharger } from "@/lib/services/search";
import { chargerSlots } from "@/lib/services/availability";
import { listVehicles } from "@/lib/services/vehicles";
import { AppError } from "@/lib/errors";
import { CANCELLATION_POLICIES, connectorLabel } from "@/lib/constants";
import { formatPaise } from "@/lib/money";
import { fmtDate, fmtTime, isIsoDate, localDate, minutesToHHMM, WEEKDAYS_LONG } from "@/lib/time";
import { AreaMap } from "@/components/maps";
import { ChargerArt } from "@/components/charger-art";
import { DateStrip } from "@/components/date-strip";
import { Badge, buttonClass, Card, Notice, Stars, StarRow } from "@/components/ui";
import { ReportReviewButton } from "@/components/review-forms";
import { cn, initials } from "@/lib/utils";

async function load(id: string, viewerId?: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  try {
    return await getPublicCharger(id, viewerId);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await load(id);
  return { title: `${c.title} · ${c.locality}` };
}

export default async function ChargerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string; vehicle?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const c = await load(id, user?.id);
  const today = localDate(new Date(), c.timezone);
  const date = sp.date && isIsoDate(sp.date) && sp.date >= today ? sp.date : today;
  const slots = await chargerSlots({ id: c.id, slotMinutes: c.slotMinutes, timezone: c.timezone }, date);
  const open = slots.filter((s) => s.available);
  const vehicles = user ? await listVehicles(user.id) : [];
  const compatible = vehicles.filter((v) => v.connectors.some((k) => c.connectors.includes(k)));
  const policy = CANCELLATION_POLICIES[c.cancellationPolicy];
  const openDays = new Set(c.rules.map((r) => r.weekday));
  const bookHref = (start?: string) => `/chargers/${c.id}/book?date=${date}${start ? `&start=${encodeURIComponent(start)}` : ""}`;

  const canBook = c.status === "active" && !c.isOwner;
  let blocker: string | null = null;
  if (c.isOwner) blocker = "This is your listing — switch to a different account to test booking.";
  else if (c.status !== "active") blocker = "This listing isn't accepting bookings right now.";
  else if (user && vehicles.length && !compatible.length) blocker = `None of your vehicles support ${c.connectors.map(connectorLabel).join(" / ")}.`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link href="/chargers" className="text-sm text-muted hover:text-ink">← Back to search</Link>

      {/* Gallery */}
      <div className={cn("mt-4 grid gap-2 overflow-hidden rounded-2xl", c.photos.length > 1 ? "sm:grid-cols-[2fr_1fr]" : "")}>
        <div className="aspect-[16/9] bg-surface-2 sm:aspect-[21/9] sm:max-h-[420px]">
          {c.photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photos[0].url} alt={c.title} className="size-full object-cover" />
          ) : (
            <ChargerArt seed={c.id} className="size-full" />
          )}
        </div>
        {c.photos.length > 1 && (
          <div className="hidden grid-rows-2 gap-2 sm:grid">
            {c.photos.slice(1, 3).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" className="size-full object-cover" />
            ))}
          </div>
        )}
      </div>
      {c.photos.length > 3 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {c.photos.slice(3).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={p.url} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {c.bookingMode === "instant" ? <Badge tone="volt">Instant booking</Badge> : <Badge>Host approves requests</Badge>}
            {c.status !== "active" && <Badge tone="warn">{c.status === "draft" ? "Draft — not published" : "Paused"}</Badge>}
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{c.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            <span className="flex items-center gap-1.5"><MapPin size={15} /> {c.locality}, {c.city}</span>
            <Stars value={c.rating.avg} count={c.rating.count} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Spec icon={<Zap size={16} />} label="Max power" value={`${c.powerKw} kW`} />
            <Spec icon={<span className="text-xs font-bold">₹</span>} label="Price" value={`${formatPaise(c.pricePerKwhPaise, { short: true })}/kWh`} accent />
            <Spec icon={<CalendarClock size={16} />} label="Slot length" value={`${c.slotMinutes} min`} />
            <Spec icon={<ShieldCheck size={16} />} label="Cancellation" value={policy.label} />
          </div>

          <Block title="Connectors">
            <div className="flex flex-wrap gap-2">
              {c.connectors.map((k) => (
                <Badge key={k} tone={compatible.some((v) => v.connectors.includes(k)) ? "volt" : "neutral"}>{connectorLabel(k)}</Badge>
              ))}
            </div>
            {user && vehicles.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                {compatible.length ? <>Compatible with your {compatible.map((v) => v.model).join(", ")}.</> : <span className="text-warn">Not compatible with your registered vehicles.</span>}
              </p>
            )}
          </Block>

          {c.description && (
            <Block title="About this charger">
              <p className="whitespace-pre-line text-muted">{c.description}</p>
              {c.amenities.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {c.amenities.map((a) => <Badge key={a}>{a}</Badge>)}
                </div>
              )}
            </Block>
          )}

          <Block title="Parking & access">
            <div className="space-y-3 text-sm">
              {c.parkingInfo && <p className="flex gap-2.5 text-muted"><ParkingCircle size={18} className="shrink-0 text-faint" /> {c.parkingInfo}</p>}
              <p className="flex gap-2.5 text-muted"><Lock size={18} className="shrink-0 text-faint" /> The exact address, map pin and arrival instructions are shared with you once your booking is confirmed.</p>
            </div>
          </Block>

          {c.safetyInfo && (
            <Block title="Safety notes from the host">
              <p className="flex gap-2.5 text-sm text-muted"><AlertTriangle size={18} className="shrink-0 text-warn" /> {c.safetyInfo}</p>
            </Block>
          )}

          <Block title="Approximate location">
            <div className="h-64 overflow-hidden rounded-2xl border border-line">
              <AreaMap lat={c.approx.lat} lng={c.approx.lng} radiusM={c.approx.radiusM} />
            </div>
            <p className="mt-2 text-xs text-faint">Shown within about 600 m for the host&apos;s privacy.</p>
          </Block>

          <Block title="Weekly hours">
            <div className="grid gap-1.5 text-sm sm:grid-cols-2">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const rs = c.rules.filter((r) => r.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
                return (
                  <div key={d} className="flex justify-between rounded-lg bg-surface px-3 py-2">
                    <span className="text-muted">{WEEKDAYS_LONG[d]}</span>
                    <span className={rs.length ? "" : "text-faint"}>{rs.length ? rs.map((r) => `${minutesToHHMM(r.startMinute)}–${minutesToHHMM(r.endMinute)}`).join(", ") : "Closed"}</span>
                  </div>
                );
              })}
            </div>
          </Block>

          <Block title="Cancellation policy">
            <p className="text-sm text-muted"><span className="font-medium text-ink">{policy.label}.</span> {policy.summary} You only pay after charging, so nothing is charged for cancelling — but late cancellations are shown to hosts.</p>
          </Block>

          <Block title={`Reviews${c.rating.count ? ` · ${c.rating.avg?.toFixed(1)} ★ (${c.rating.count})` : ""}`}>
            {c.reviews.length === 0 ? (
              <p className="text-sm text-faint">No reviews yet. Reviews appear after completed, paid sessions.</p>
            ) : (
              <div className="space-y-4">
                {c.reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-xs font-bold">{initials(r.authorName)}</span>
                        <div>
                          <div className="text-sm font-medium">{r.authorName}</div>
                          <div className="text-xs text-faint">{fmtDate(r.createdAt)}</div>
                        </div>
                      </div>
                      <StarRow rating={r.rating} />
                    </div>
                    {r.comment && <p className="mt-3 text-sm text-muted">{r.comment}</p>}
                    {user && <ReportReviewButton reviewId={r.id} />}
                  </div>
                ))}
              </div>
            )}
          </Block>
        </div>

        {/* Booking sidebar */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-display text-3xl font-bold text-volt">{formatPaise(c.pricePerKwhPaise, { short: true })}</span>
                <span className="text-muted"> / kWh</span>
              </div>
              <span className="text-sm text-muted">{c.powerKw} kW</span>
            </div>
            <p className="mt-1 text-xs text-faint">Pay after charging, based on the battery energy you gain.</p>

            <div className="mt-5">
              <div className="mb-2 text-sm font-medium">Pick a date</div>
              <DateStrip selected={date} hrefFor={(d) => `/chargers/${c.id}?date=${d}`} availableDays={openDays} />
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{fmtDate(new Date(`${date}T12:00:00+05:30`))}</span>
                <span className="text-faint">{open.length} open</span>
              </div>
              {slots.length === 0 ? (
                <p className="rounded-xl bg-surface-2 px-3 py-4 text-center text-sm text-faint">Closed on this day</p>
              ) : (
                <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
                  {slots.map((s) =>
                    s.available && canBook ? (
                      <Link key={s.start.toISOString()} href={bookHref(s.start.toISOString())} className="rounded-lg border border-line bg-surface-2 py-2 text-center text-sm font-medium hover:border-volt hover:text-volt">
                        {fmtTime(s.start, c.timezone)}
                      </Link>
                    ) : (
                      <span key={s.start.toISOString()} title={s.reason} className={cn("rounded-lg border border-line/50 py-2 text-center text-sm", s.available ? "" : "text-faint line-through decoration-line-strong")}>
                        {fmtTime(s.start, c.timezone)}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
            {blocker ? (
              <Notice tone="warn" className="mt-5">{blocker}</Notice>
            ) : (
              <Link href={bookHref(open[0]?.start.toISOString())} className={buttonClass("primary", "lg", true) + " mt-5"}>
                {user ? "Book a slot" : "Sign in to book"}
              </Link>
            )}
            {!user && <p className="mt-2 text-center text-xs text-faint">You&apos;ll need an account and a registered vehicle.</p>}
          </Card>

          <Card className="mt-4 p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-volt/10 font-display font-bold text-volt">{c.host.firstName[0]}</span>
              <div>
                <div className="font-medium">Hosted by {c.host.firstName}</div>
                <div className="text-xs text-muted">Member since {c.host.memberSince.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Stars value={c.host.rating.avg} count={c.host.rating.count} />
              {c.host.phoneVerified && <Badge tone="volt"><BadgeCheck size={12} /> Phone verified</Badge>}
            </div>
          </Card>
          <div className="mt-4 flex gap-2 px-1 text-xs text-faint">
            <Info size={14} className="shrink-0" /> Energy is estimated from your battery capacity and the start/end battery % recorded by the host. Charging losses mean the wall draw is slightly higher.
          </div>
          {user && !vehicles.length && (
            <Notice tone="info" className="mt-4" title="Add your vehicle first">
              <Link href={`/profile?next=/chargers/${c.id}#vehicles`} className="inline-flex items-center gap-1 underline"><Car size={14} /> Register your EV</Link> so we can check compatibility and estimate costs.
            </Notice>
          )}
        </aside>
      </div>
      {!blocker && (
        <div className={cn("fixed inset-x-0 z-30 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-xl lg:hidden", user ? "bottom-[calc(57px+env(safe-area-inset-bottom))]" : "bottom-0")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-display text-xl font-bold text-volt">{formatPaise(c.pricePerKwhPaise, { short: true })}</span>
              <span className="text-sm text-muted"> / kWh · {c.powerKw} kW</span>
            </div>
            <Link href={bookHref(open[0]?.start.toISOString())} className={buttonClass("primary", "md")}>{user ? "Book a slot" : "Sign in to book"}</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Spec({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-1.5 text-xs text-faint">{icon} {label}</div>
      <div className={cn("mt-1 font-display font-semibold", accent && "text-volt")}>{value}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
