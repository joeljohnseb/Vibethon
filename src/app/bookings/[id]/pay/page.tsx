import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { loadBooking } from "@/lib/load-booking";
import { config } from "@/lib/config";
import { formatPaise } from "@/lib/money";
import { BillBreakdown } from "@/components/booking-parts";
import { PayButton } from "@/components/pay-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { refreshPaymentAction } from "@/app/actions/bookings";
import { Card, CardHeader, LinkButton, Notice } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Pay for charging" };

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returned?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUserPage(`/bookings/${id}/pay`);
  const d = await loadBooking(user.id, id);
  if (d.role !== "taker") redirect(`/host/bookings/${id}`);
  const s = d.session;
  const inv = d.invoice;
  if (!inv || !s) redirect(`/bookings/${id}`);
  const last = d.payments[0];
  const mode = config.payments.mode;

  if (s.status === "completed")
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-volt/15 text-volt"><CheckCircle2 size={34} /></div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Payment confirmed</h1>
        <p className="mt-2 text-muted">{formatPaise(inv.totalPaise)} paid for {d.booking.reference}{inv.paidAt && ` on ${fmtDateTime(inv.paidAt, d.charger.timezone)}`}. Your session is complete.</p>
        <div className="mt-6 flex justify-center gap-2">
          <LinkButton href={`/bookings/${id}/receipt`}>View receipt</LinkButton>
          <LinkButton href={`/bookings/${id}#review`} variant="secondary">Leave a review</LinkButton>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {s.status === "payment_pending" && <AutoRefresh every={4000} />}
      <Link href={`/bookings/${id}`} className="text-sm text-muted hover:text-ink">← Booking {d.booking.reference}</Link>
      <h1 className="mt-3 font-display text-2xl font-semibold">Charging bill</h1>
      <p className="mt-1 text-sm text-muted">{d.charger.title} · Invoice {inv.number}</p>

      {sp.returned && s.status === "awaiting_payment" && <Notice tone="warn" className="mt-4">We haven&apos;t received confirmation from the gateway yet.</Notice>}
      {s.status === "payment_failed" && (
        <Notice tone="danger" className="mt-4" title="Payment failed">{last?.failureReason ?? "The payment didn't go through."} No money was taken — please try again.</Notice>
      )}
      {s.status === "payment_pending" && (
        <Notice tone="warn" className="mt-4" title="Payment processing">The gateway is still confirming your payment. This page refreshes automatically — please don&apos;t pay again.</Notice>
      )}

      <Card className="mt-5">
        <CardHeader title="Breakdown" subtitle="Calculated by Eber from the host's battery readings" />
        <div className="p-5">
          <BillBreakdown d={d} />
        </div>
      </Card>

      <div className="mt-5">
        {mode === "disabled" ? (
          <Notice tone="danger">Payments aren&apos;t configured on this server.</Notice>
        ) : s.status === "payment_pending" ? (
          <ActionForm action={refreshPaymentAction}>
            <input type="hidden" name="bookingId" value={id} />
            <SubmitButton variant="secondary" full>Check status now</SubmitButton>
          </ActionForm>
        ) : (
          <PayButton bookingId={id} label={`${s.status === "payment_failed" ? "Retry" : "Pay"} ${formatPaise(inv.totalPaise)}`} prefill={{ name: user.name, email: user.email, contact: user.phone }} />
        )}
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-faint">
          <ShieldCheck size={14} /> {mode === "razorpay" ? "Secured by Razorpay · UPI, cards, net banking" : "Test mode gateway — no real money moves"}
        </div>
      </div>
    </div>
  );
}
