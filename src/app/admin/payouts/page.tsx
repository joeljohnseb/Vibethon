import { requireAdminPage } from "@/lib/auth/session";
import { adminListPayouts } from "@/lib/services/admin";
import { PayoutAdminForm } from "@/components/admin-forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { fmtDate } from "@/lib/time";

export default async function AdminPayouts() {
  await requireAdminPage();
  const rows = await adminListPayouts();
  return (
    <div>
      <PageHeader title="Payouts" subtitle="Mark a payout transferred only after the bank / payout provider confirms it." />
      {rows.length === 0 ? <EmptyState title="No payout requests" /> : (
        <Card className="divide-y divide-line">
          {rows.map(({ p, giverName, giverEmail }) => (
            <div key={p.id} className="flex flex-col gap-3 px-4 py-3 text-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-medium">{formatPaise(p.amountPaise)} → {giverName} <span className="text-xs text-muted">{giverEmail}</span></div>
                <div className="text-xs text-faint">Requested {fmtDate(p.createdAt)}{p.providerRef && ` · ref ${p.providerRef}`}</div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={p.status === "paid" ? "volt" : p.status === "failed" ? "danger" : "warn"}>{p.status === "paid" ? "transferred" : p.status}</Badge>
                <PayoutAdminForm payoutId={p.id} status={p.status} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
