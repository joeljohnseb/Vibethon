import Link from "next/link";
import { BatteryCharging, Clock, CreditCard, ExternalLink, KeyRound, MapPin, Navigation, Phone, Receipt } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { loadBooking } from "@/lib/load-booking";
import { inCodeWindow } from "@/lib/services/charging";
import { CODE_WINDOW_BEFORE_MIN, isLateCancellation } from "@/lib/constants";
import { fmtDateTime, fmtTime } from "@/lib/time";
import { formatPaise } from "@/lib/money";
import { AreaMap } from "@/components/maps";
import { AutoRefresh } from "@/components/auto-refresh";
import { BillBreakdown, BookingHeader, Timeline } from "@/components/booking-parts";
import { StartCodePanel } from "@/components/start-code";
import { ReviewForm } from "@/components/review-forms";
import { CancelBookingForm } from "@/components/cancel-booking";
import { Card, CardHeader, LinkButton, Notice, StarRow } from "@/components/ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Booking" };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUserPage(`/bookings/${id}`);
  const d = await loadBooking(user.id, id);
  if (d.role === "giver") redirect(`/host/bookings/${id}`);
  const b = d.booking;
  const s = d.session;
  const tz = d.charger.timezone;
  const live = (b.status === "confirmed" && s && ["awaiting_start", "active", "payment_pending"].includes(s.status)) || b.status === "pending";
  const windowOpen = inCodeWindow(b);
  const p = d.charger.private;
  const mapsUrl = p ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}` : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {live && <AutoRefresh every={b.status === "pending" ? 15000 : 4000} />}
      <Link href="/bookings" className="text-sm text-muted hover:text-ink">← My bookings</Link>
      {sp.new && b.status === "pending" && (
        <Notice tone="volt" className="mt-4" title="Request sent">The host has been notified. You&apos;ll get a notification as soon as they respond.</Notice>
      )}
      {sp.new && b.status === "confirmed" && (
        <Notice tone="volt" className="mt-4" title="Booking confirmed">Your slot is reserved. The address and access instructions are below.</Notice>
      )}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <BookingHeader d={d} />

          {/* Primary action area, by state */}
          {b.status === "pending" && (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 shrink-0 text-warn" />
                <div>
                  <div className="font-display font-semibold">Waiting for the host to respond</div>
                  <p className="mt-1 text-sm text-muted">Requests expire automatically if not answered before the start time. The exact address is shared once confirmed.</p>
                </div>
              </div>
            </Card>
          )}

          {b.status === "confirmed" && s?.status === "awaiting_start" && (
            <>
              {s.codeVerifiedAt ? (
                <Notice tone="volt" title="Code verified">Your host is recording your starting battery level. Charging will begin in a moment.</Notice>
              ) : windowOpen ? (
                <StartCodePanel bookingId={b.id} />
              ) : (
                <Card className="p-5">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 shrink-0 text-volt" />
                    <div>
                      <div className="font-display font-semibold">Your start code unlocks at {fmtTime(new Date(b.startAt.getTime() - CODE_WINDOW_BEFORE_MIN * 60_000), tz)}</div>
                      <p className="mt-1 text-sm text-muted">Open this page when you arrive. You&apos;ll show a one-time code to the host to start charging.</p>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}

          {s?.status === "active" && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-4 bg-gradient-to-r from-volt/15 to-transparent p-5">
                <div className="relative grid size-14 place-items-center rounded-2xl bg-volt/20 text-volt">
                  <BatteryCharging size={28} />
                  <span className="absolute -right-1 -top-1 size-3 animate-ping rounded-full bg-volt" />
                </div>
                <div>
                  <div className="font-display text-lg font-semibold">Charging in progress</div>
                  <div className="text-sm text-muted">
                    Started {s.startedAt && fmtTime(s.startedAt, tz)} at {d.readings.start?.percent}% · slot ends {fmtTime(b.endAt, tz)}
                  </div>
                </div>
              </div>
              <p className="border-t border-line px-5 py-3 text-xs text-faint">When you&apos;re done, the host records your ending battery %. Your bill appears here automatically.</p>
            </Card>
          )}

          {s && ["awaiting_payment", "payment_failed", "payment_pending"].includes(s.status) && d.invoice && (
            <Card>
              <CardHeader title="Your bill" subtitle={`Invoice ${d.invoice.number}`} />
              <div className="p-5">
                {s.status === "payment_failed" && <Notice tone="danger" className="mb-4">Your last payment attempt failed. You can try again.</Notice>}
                {s.status === "payment_pending" && <Notice tone="warn" className="mb-4">A payment is being processed. This page updates automatically.</Notice>}
                <BillBreakdown d={d} compact />
                <LinkButton href={`/bookings/${b.id}/pay`} size="lg" full className="mt-4">
                  <CreditCard size={18} /> {s.status === "payment_failed" ? "Retry payment" : s.status === "payment_pending" ? "View payment status" : `Pay ${formatPaise(d.invoice.totalPaise)}`}
                </LinkButton>
              </div>
            </Card>
          )}

          {b.status === "completed" && d.invoice && (
            <Card>
              <CardHeader title="Session complete" subtitle={`Paid ${d.invoice.paidAt ? fmtDateTime(d.invoice.paidAt, tz) : ""}`} action={<LinkButton href={`/bookings/${b.id}/receipt`} variant="secondary" size="sm"><Receipt size={15} /> Receipt</LinkButton>} />
              <div className="p-5">
                <BillBreakdown d={d} compact />
              </div>
            </Card>
          )}

          {b.status === "completed" && (
            <Card id="review" className="p-5">
              <div className="mb-3 font-display font-semibold">Reviews</div>
              {d.myReview ? (
                <div className="rounded-xl bg-surface-2 p-4">
                  <div className="text-xs text-faint">Your review of {d.giver.name.split(" ")[0]}</div>
                  <div className="mt-1"><StarRow rating={d.myReview.rating} /></div>
                  {d.myReview.comment && <p className="mt-2 text-sm text-muted">{d.myReview.comment}</p>}
                </div>
              ) : (
                <ReviewForm bookingId={b.id} subject={`charging at ${d.giver.name.split(" ")[0]}'s`} />
              )}
              {d.theirReview && (
                <div className="mt-3 rounded-xl bg-surface-2 p-4">
                  <div className="text-xs text-faint">{d.giver.name.split(" ")[0]} reviewed you</div>
                  <div className="mt-1"><StarRow rating={d.theirReview.rating} /></div>
                  {d.theirReview.comment && <p className="mt-2 text-sm text-muted">{d.theirReview.comment}</p>}
                </div>
              )}
            </Card>
          )}

          {["rejected", "cancelled", "expired"].includes(b.status) && (
            <Card className="p-5">
              <div className="font-display font-semibold">
                {b.status === "rejected" ? "The host declined this request" : b.status === "expired" ? "This request expired" : "This booking was cancelled"}
              </div>
              {b.cancelReason && <p className="mt-1 text-sm text-muted">Reason: {b.cancelReason}</p>}
              <LinkButton href="/chargers" variant="secondary" className="mt-4">Find another charger</LinkButton>
            </Card>
          )}

          {/* Location — only after confirmation */}
          {p && b.status !== "completed" && (
            <Card>
              <CardHeader title="Address & arrival" />
              <div className="h-56 border-b border-line">
                <AreaMap lat={p.lat} lng={p.lng} exact />
              </div>
              <div className="space-y-4 p-5 text-sm">
                <div className="flex gap-3">
                  <MapPin size={18} className="shrink-0 text-volt" />
                  <div>
                    <div className="font-medium">{p.addressLine}</div>
                    <div className="text-muted">{d.charger.locality}, {d.charger.city} {p.postalCode}</div>
                  </div>
                </div>
                {p.accessInstructions && (
                  <div className="flex gap-3">
                    <KeyRound size={18} className="shrink-0 text-volt" />
                    <div><div className="font-medium">Access instructions</div><p className="whitespace-pre-line text-muted">{p.accessInstructions}</p></div>
                  </div>
                )}
                {d.charger.parkingInfo && <p className="text-muted"><span className="font-medium text-ink">Parking: </span>{d.charger.parkingInfo}</p>}
                {d.charger.safetyInfo && <p className="text-muted"><span className="font-medium text-ink">Safety: </span>{d.charger.safetyInfo}</p>}
                <div className="flex flex-wrap gap-2">
                  {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-volt px-4 text-sm font-semibold text-volt-ink"><Navigation size={15} /> Directions <ExternalLink size={13} /></a>}
                  {d.giver.phone && <a href={`tel:${d.giver.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold"><Phone size={15} /> Call host</a>}
                </div>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Timeline d={d} />
          {(b.status === "pending" || (b.status === "confirmed" && s?.status === "awaiting_start" && !s.codeVerifiedAt)) && (
            <Card className="p-5">
              <div className="mb-2 text-sm font-medium">Need to cancel?</div>
              <CancelBookingForm bookingId={b.id} policy={b.cancellationPolicy} late={b.status === "confirmed" && isLateCancellation(b.startAt, b.cancellationPolicy)} confirmed={b.status === "confirmed"} asTaker />
            </Card>
          )}
          <Link href={`/help?booking=${b.reference}`} className="block text-center text-sm text-muted hover:text-ink">Problem with this booking? Get help</Link>
        </aside>
      </div>
    </div>
  );
}
