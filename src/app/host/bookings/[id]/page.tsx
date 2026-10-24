import Link from "next/link";
import { redirect } from "next/navigation";
import { BatteryCharging, Clock, Phone, Receipt } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { loadBooking } from "@/lib/load-booking";
import { inCodeWindow } from "@/lib/services/charging";
import { userRatings } from "@/lib/services/ratings";
import { CODE_WINDOW_BEFORE_MIN } from "@/lib/constants";
import { fmtTime } from "@/lib/time";
import { formatPaise } from "@/lib/money";
import { AutoRefresh } from "@/components/auto-refresh";
import { BillBreakdown, BookingHeader, Timeline } from "@/components/booking-parts";
import { DecisionButtons } from "@/components/host-actions";
import { EndReadingForm, StartReadingForm, VerifyCodeForm } from "@/components/session-forms";
import { CancelBookingForm } from "@/components/cancel-booking";
import { ReviewForm } from "@/components/review-forms";
import { Card, CardHeader, LinkButton, Notice, Stars, StarRow } from "@/components/ui";

export const metadata = { title: "Booking details" };

export default async function HostBooking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/host/bookings/${id}`);
  const d = await loadBooking(user.id, id);
  if (d.role === "taker") redirect(`/bookings/${id}`);
  const b = d.booking;
  const s = d.session;
  const tz = d.charger.timezone;
  const driverRating = (await userRatings([b.takerId], "giver_to_taker")).get(b.takerId) ?? { avg: null, count: 0 };
  const live = s && ["awaiting_start", "awaiting_payment", "payment_pending", "payment_failed"].includes(s.status);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {live && <AutoRefresh every={6000} />}
      <Link href="/host/bookings" className="text-sm text-muted hover:text-ink">← Bookings</Link>
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <BookingHeader d={d} />

          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-xs text-faint">Driver</div>
              <div className="font-medium">{d.taker.name}</div>
              <Stars value={driverRating.avg} count={driverRating.count} />
            </div>
            {d.taker.phone && <a href={`tel:${d.taker.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold"><Phone size={15} /> {d.taker.phone}</a>}
          </Card>

          {b.status === "pending" && (
            <Card>
              <CardHeader title="Respond to this request" subtitle="Approving reserves the slot and shares your address and access instructions with the driver." />
              <div className="p-5">
                <DecisionButtons bookingId={b.id} withNote />
              </div>
            </Card>
          )}

          {b.status === "confirmed" && s?.status === "awaiting_start" && (
            <Card>
              <CardHeader title="Start the session" subtitle="Step 1: verify the driver's code. Step 2: record the starting battery %." />
              <div className="p-5">
                {s.codeVerifiedAt ? (
                  <StartReadingForm bookingId={b.id} />
                ) : inCodeWindow(b) ? (
                  <VerifyCodeForm bookingId={b.id} />
                ) : (
                  <div className="flex gap-3 text-sm text-muted">
                    <Clock size={18} className="shrink-0 text-faint" /> Code entry opens at {fmtTime(new Date(b.startAt.getTime() - CODE_WINDOW_BEFORE_MIN * 60_000), tz)}, 30 minutes before the slot.
                  </div>
                )}
              </div>
            </Card>
          )}

          {s?.status === "active" && d.readings.start && (
            <Card>
              <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-volt/15 to-transparent px-5 py-4">
                <BatteryCharging className="text-volt" />
                <div>
                  <div className="font-display font-semibold">Charging since {s.startedAt && fmtTime(s.startedAt, tz)}</div>
                  <div className="text-sm text-muted">Started at {d.readings.start.percent}% · slot ends {fmtTime(b.endAt, tz)}</div>
                </div>
              </div>
              <div className="p-5">
                <EndReadingForm bookingId={b.id} startPercent={d.readings.start.percent} batteryKwh={b.vehicleBatteryKwh} pricePaise={b.pricePerKwhPaise} />
              </div>
            </Card>
          )}

          {d.invoice && (
            <Card>
              <CardHeader
                title="Session billing summary"
                subtitle={s?.status === "completed" ? "Paid — added to your earnings" : s?.status === "payment_failed" ? "Driver's payment failed — they've been asked to retry" : "Waiting for the driver to pay"}
                action={s?.status === "completed" ? <LinkButton href={`/bookings/${b.id}/receipt`} variant="secondary" size="sm"><Receipt size={15} /> Receipt</LinkButton> : undefined}
              />
              <div className="p-5">
                <BillBreakdown d={d} />
                <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Your earnings</span><span className="font-semibold text-volt">{formatPaise(d.invoice.giverEarningsPaise)}</span></div>
                  {d.invoice.totalPaise !== d.invoice.giverEarningsPaise && (
                    <div className="mt-1 flex justify-between text-xs"><span className="text-faint">Platform fees, taxes & adjustments (not yours)</span><span className="text-faint">{formatPaise(d.invoice.totalPaise - d.invoice.giverEarningsPaise)}</span></div>
                  )}
                </div>
                {s?.status !== "completed" && <Notice tone="neutral" className="mt-3">The session is completed only after the payment gateway confirms the payment.</Notice>}
              </div>
            </Card>
          )}

          {b.status === "completed" && (
            <Card id="review" className="p-5">
              <div className="mb-3 font-display font-semibold">Reviews</div>
              {d.myReview ? (
                <div className="rounded-xl bg-surface-2 p-4">
                  <div className="text-xs text-faint">Your review of {d.taker.name.split(" ")[0]}</div>
                  <div className="mt-1"><StarRow rating={d.myReview.rating} /></div>
                  {d.myReview.comment && <p className="mt-2 text-sm text-muted">{d.myReview.comment}</p>}
                </div>
              ) : (
                <ReviewForm bookingId={b.id} subject={d.taker.name.split(" ")[0]} />
              )}
              {d.theirReview && (
                <div className="mt-3 rounded-xl bg-surface-2 p-4">
                  <div className="text-xs text-faint">{d.taker.name.split(" ")[0]} reviewed you</div>
                  <div className="mt-1"><StarRow rating={d.theirReview.rating} /></div>
                  {d.theirReview.comment && <p className="mt-2 text-sm text-muted">{d.theirReview.comment}</p>}
                </div>
              )}
            </Card>
          )}

          {["rejected", "cancelled", "expired"].includes(b.status) && (
            <Card className="p-5 text-sm text-muted">
              This booking is <span className="font-medium text-ink">{b.status}</span>.{b.cancelReason && ` Reason: ${b.cancelReason}`}
              {b.lateCancellation && <span className="text-warn"> (late cancellation by the driver)</span>}
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Timeline d={d} />
          {b.status === "confirmed" && s?.status === "awaiting_start" && !s.codeVerifiedAt && (
            <Card className="p-5">
              <div className="mb-2 text-sm font-medium">Can&apos;t host this session?</div>
              <CancelBookingForm bookingId={b.id} policy={b.cancellationPolicy} confirmed />
            </Card>
          )}
          <Link href={`/help?booking=${b.reference}`} className="block text-center text-sm text-muted hover:text-ink">Report a problem</Link>
        </aside>
      </div>
    </div>
  );
}
