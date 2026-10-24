import { requireAdminPage } from "@/lib/auth/session";
import { adminListReports } from "@/lib/services/admin";
import { ReportForm } from "@/components/admin-forms";
import { Badge, Card, EmptyState, PageHeader, StarRow } from "@/components/ui";
import { fmtDate } from "@/lib/time";

export default async function AdminReports() {
  await requireAdminPage();
  const rows = await adminListReports();
  return (
    <div>
      <PageHeader title="Review reports" />
      {rows.length === 0 ? <EmptyState title="No reports" /> : (
        <div className="space-y-3">
          {rows.map(({ report, review, reporterName, authorName }) => (
            <Card key={report.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div><span className="font-medium">{authorName}</span>&apos;s review <StarRow rating={review.rating} /> {review.hiddenAt && <Badge tone="danger">hidden</Badge>}</div>
                <Badge tone={report.status === "open" ? "warn" : "neutral"}>{report.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">“{review.comment || "(no text)"}”</p>
              <p className="mt-2 text-sm"><span className="text-faint">Reported by {reporterName} on {fmtDate(report.createdAt)}:</span> {report.reason}</p>
              {report.status === "open" && <div className="mt-3"><ReportForm reportId={report.id} /></div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
