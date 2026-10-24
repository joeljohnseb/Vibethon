import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/auth/session";
import { loadBooking } from "@/lib/load-booking";
import { formatKwh, formatPaise } from "@/lib/money";
import { fmtDateTime, fmtRange } from "@/lib/time";
import { connectorLabel } from "@/lib/constants";
import { LogoMark } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Receipt" };

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/bookings/${id}/receipt`);
  const d = await loadBooking(user.id, id, { admin: user.isAdmin });
  const inv = d.invoice;
  if (!inv || inv.status !== "paid") notFound();
  const pay = d.payments.find((p) => p.status === "captured");
  const tz = d.charger.timezone;
  const b = d.booking;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="no-print mb-4 flex justify-between gap-2">
        <LinkButton href={d.role === "giver" ? `/host/bookings/${id}` : `/bookings/${id}`} variant="ghost" size="sm">← Back</LinkButton>
        <PrintButton />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark />
            <div>
              <div className="font-display text-xl font-bold">eber</div>
              <div className="text-xs text-muted">Payment receipt</div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono">{inv.number}</div>
            <div className="text-muted">{inv.paidAt && fmtDateTime(inv.paidAt, tz)}</div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-faint">Charging session</div>
            <div className="mt-1 font-medium">{d.charger.title}</div>
            <div className="text-muted">{d.charger.locality}, {d.charger.city}</div>
            <div className="text-muted">{fmtRange(b.startAt, b.endAt, tz)}</div>
            <div className="text-muted">Booking {b.reference}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-faint">Parties</div>
            <div className="mt-1">Driver: {d.taker.name}</div>
            <div>Host: {d.giver.name}</div>
            <div className="text-muted">{b.vehicleLabel} · {connectorLabel(b.connector)}</div>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <tbody className="divide-y divide-line">
            <tr><td className="py-2 text-muted">Battery capacity (at booking)</td><td className="py-2 text-right">{inv.batteryKwh} kWh</td></tr>
            <tr><td className="py-2 text-muted">Battery start → end</td><td className="py-2 text-right">{inv.startPercent}% → {inv.endPercent}%</td></tr>
            <tr><td className="py-2 text-muted">Estimated energy gained</td><td className="py-2 text-right">{formatKwh(inv.billableWh)}</td></tr>
            <tr><td className="py-2 text-muted">Agreed rate</td><td className="py-2 text-right">{formatPaise(inv.pricePerKwhPaise)}/kWh</td></tr>
          </tbody>
        </table>

        <table className="mt-6 w-full text-sm">
          <tbody className="divide-y divide-line">
            {inv.lines.map((l) => (
              <tr key={l.code}>
                <td className="py-2">{l.label}{l.detail && <div className="text-xs text-faint">{l.detail}</div>}</td>
                <td className="py-2 text-right tabular-nums">{formatPaise(l.amountPaise)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-3 font-semibold">Total paid</td>
              <td className="py-3 text-right font-display text-xl font-bold tabular-nums">{formatPaise(inv.totalPaise)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 text-xs text-muted">
          {pay ? (
            <>Paid via {pay.provider === "sandbox" ? "test gateway (sandbox)" : "Razorpay"}{pay.method ? ` · ${pay.method.toUpperCase()}` : ""} · Payment ID {pay.providerPaymentId}</>
          ) : (
            <>No payment was required.</>
          )}
        </div>
        <p className="mt-4 text-xs text-faint">
          Billing method: battery-energy estimate (vehicle capacity × change in state of charge, recorded by the host). Electricity drawn from the supply can exceed the energy stored because of charging losses. This is not a tax invoice.
        </p>
      </div>
    </div>
  );
}
