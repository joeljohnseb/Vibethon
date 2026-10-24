import { requireAdminPage } from "@/lib/auth/session";
import { adminListBookings } from "@/lib/services/admin";
import { AdminCancelForm } from "@/components/admin-forms";
import { BookingStatusPill } from "@/components/status";
import { Card, inputClass, PageHeader } from "@/components/ui";
import { fmtRange } from "@/lib/time";
import type { BookingStatus, SessionStatus } from "@/lib/state";

export default async function AdminBookings({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const q = (await searchParams).q?.trim();
  const rows = await adminListBookings(q);
  return (
    <div>
      <PageHeader title="Bookings" />
      <form className="mb-4 max-w-sm"><input name="q" defaultValue={q} placeholder="Search by reference (EBR-…)" className={inputClass} /></form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs text-faint"><tr><th className="px-4 py-2">Ref</th><th className="px-4 py-2">Charger</th><th className="px-4 py-2">Driver → Host</th><th className="px-4 py-2">When</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ b, chargerTitle, sessionStatus, takerName, giverName }) => (
              <tr key={b.id}>
                <td className="px-4 py-2.5 font-mono text-xs"><a href={`/bookings/${b.id}/receipt`} className="hover:text-volt">{b.reference}</a></td>
                <td className="px-4 py-2.5">{chargerTitle}</td>
                <td className="px-4 py-2.5 text-muted">{takerName} → {giverName}</td>
                <td className="px-4 py-2.5 text-muted">{fmtRange(b.startAt, b.endAt)}</td>
                <td className="px-4 py-2.5"><BookingStatusPill status={b.status as BookingStatus} session={sessionStatus as SessionStatus | null} /></td>
                <td className="px-4 py-2.5">{(b.status === "pending" || (b.status === "confirmed" && sessionStatus === "awaiting_start")) && <AdminCancelForm bookingId={b.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
