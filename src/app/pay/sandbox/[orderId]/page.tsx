import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { FlaskConical } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { bookings, invoices, payments } from "@/lib/db/schema";
import { config } from "@/lib/config";
import { formatPaise } from "@/lib/money";
import { SandboxCheckout } from "@/components/sandbox-checkout";
import { Card } from "@/components/ui";

export const metadata = { title: "Test payment" };

export default async function SandboxPay({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUserPage();
  if (config.payments.mode !== "sandbox") notFound();
  const [row] = await db
    .select({ p: payments, inv: invoices, b: bookings })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(bookings, eq(bookings.id, invoices.bookingId))
    .where(and(eq(payments.provider, "sandbox"), eq(payments.providerOrderId, orderId)));
  if (!row || row.b.takerId !== user.id) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm font-semibold text-warn">
        <FlaskConical size={16} /> TEST MODE — simulated payment gateway
      </div>
      <Card className="p-6">
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-faint">Eber · {row.b.reference}</div>
          <div className="mt-2 font-display text-4xl font-bold">{formatPaise(row.p.amountPaise)}</div>
          <div className="mt-1 font-mono text-xs text-faint">{orderId}</div>
        </div>
        <SandboxCheckout orderId={orderId} />
        <p className="mt-5 text-center text-xs text-faint">
          This screen stands in for Razorpay when no API keys are configured. Each button makes the server send itself a signed webhook — the same verification and state changes as a real payment.
        </p>
      </Card>
    </div>
  );
}
