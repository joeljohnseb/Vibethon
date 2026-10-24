import { requireAdminPage } from "@/lib/auth/session";
import { adminListDisputes } from "@/lib/services/admin";
import { DISPUTE_CATEGORIES } from "@/lib/services/disputes";
import { DisputeAdminForm } from "@/components/admin-forms";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";

export default async function AdminDisputes() {
  await requireAdminPage();
  const rows = await adminListDisputes();
  return (
    <div>
      <PageHeader title="Disputes" />
      {rows.length === 0 ? <EmptyState title="No disputes" /> : (
        <div className="space-y-3">
          {rows.map(({ d, reference, reporterName, reporterEmail }) => (
            <Card key={d.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="font-medium">{DISPUTE_CATEGORIES[d.category as keyof typeof DISPUTE_CATEGORIES] ?? d.category} {reference && <a href={`/bookings/${d.bookingId}/receipt`} className="font-mono text-xs text-muted hover:text-volt">{reference}</a>}</div>
                <Badge tone={d.status === "resolved" ? "volt" : d.status === "dismissed" ? "neutral" : "warn"}>{d.status}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-muted">{d.description}</p>
              <p className="mt-2 text-xs text-faint">{reporterName} ({reporterEmail}) · {fmtDateTime(d.createdAt)}</p>
              <DisputeAdminForm disputeId={d.id} status={d.status} resolution={d.resolution} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
