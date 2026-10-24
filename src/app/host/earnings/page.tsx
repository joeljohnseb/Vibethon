import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { earningsSummary, listEarnings, listPayouts } from "@/lib/services/earnings";
import { formatPaise } from "@/lib/money";
import { fmtDate } from "@/lib/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { requestPayoutAction } from "@/app/actions/host";
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Earnings" };

const earnTone = { unpaid: "warn", in_payout: "info", paid_out: "volt" } as const;
const earnLabel = { unpaid: "Unpaid", in_payout: "In payout", paid_out: "Paid out" } as const;
const payTone = { requested: "warn", processing: "info", paid: "volt", failed: "danger" } as const;

export default async function Earnings() {
  const user = await requireUserPage("/host/earnings");
  const [sum, rows, payouts] = await Promise.all([earningsSummary(user.id), listEarnings(user.id), listPayouts(user.id)]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader title="Earnings & payouts" subtitle="What you've earned from paid sessions, and what has actually been transferred to you." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Available to withdraw" value={formatPaise(sum.unpaid)} accent />
        <Stat label="Payout in progress" value={formatPaise(sum.inPayout)} hint="Not yet transferred" />
        <Stat label="Transferred to you" value={formatPaise(sum.paidOut)} hint="Confirmed payouts only" />
        <Stat label="Lifetime earnings" value={formatPaise(sum.lifetime)} />
      </div>

      <Card className="mt-5 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display font-semibold">Request a payout</div>
          <p className="text-sm text-muted">Bundles all unpaid earnings. Eber confirms the bank transfer and shows the reference here — funds aren&apos;t shown as transferred until then.</p>
        </div>
        <ActionForm action={requestPayoutAction}>
          <SubmitButton disabled={sum.unpaid < 100} pendingText="Requesting…">Withdraw {formatPaise(sum.unpaid, { short: true })}</SubmitButton>
        </ActionForm>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Payouts" />
        {payouts.length === 0 ? (
          <p className="p-5 text-sm text-faint">No payouts yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {payouts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <div className="font-medium">{formatPaise(p.amountPaise)}</div>
                  <div className="text-xs text-faint">Requested {fmtDate(p.createdAt)}{p.confirmedAt && ` · transferred ${fmtDate(p.confirmedAt)}`}{p.providerRef && ` · ref ${p.providerRef}`}</div>
                </div>
                <Badge tone={payTone[p.status]}>{p.status === "paid" ? "Transferred" : p.status[0].toUpperCase() + p.status.slice(1)}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader title="Earnings by session" />
        {rows.length === 0 ? (
          <div className="p-5"><EmptyState icon={<Wallet />} title="No earnings yet" body="Every session paid by a driver adds its energy charge to your balance." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-faint">
                <tr><th className="px-5 py-2 font-medium">Booking</th><th className="px-5 py-2 font-medium">Date</th><th className="px-5 py-2 text-right font-medium">Driver paid</th><th className="px-5 py-2 text-right font-medium">You earn</th><th className="px-5 py-2 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ e, reference, startAt }) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3"><Link href={`/host/bookings/${e.bookingId}`} className="font-mono text-xs hover:text-volt">{reference}</Link></td>
                    <td className="px-5 py-3 text-muted">{fmtDate(startAt)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted">{formatPaise(e.grossPaise)}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">{formatPaise(e.netPaise)}</td>
                    <td className="px-5 py-3"><Badge tone={earnTone[e.status]}>{earnLabel[e.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Notice tone="neutral" className="mt-5">
        In production, payouts run through the payment provider&apos;s marketplace/payout product (e.g. Razorpay Route or RazorpayX). Until a transfer is confirmed, earnings are shown as unpaid or in payout — never as transferred.
      </Notice>
    </div>
  );
}
