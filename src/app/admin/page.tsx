import { requireAdminPage } from "@/lib/auth/session";
import { adminRecentActions, adminStats } from "@/lib/services/admin";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  await requireAdminPage();
  const [s, actions] = await Promise.all([adminStats(), adminRecentActions()]);
  return (
    <div>
      <PageHeader title="Overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Users" value={s.users} />
        <Stat label="Live chargers" value={s.activeChargers} />
        <Stat label="Bookings" value={s.bookings} />
        <Stat label="Open disputes" value={s.openDisputes} accent={s.openDisputes > 0} />
        <Stat label="Review reports" value={s.openReports} accent={s.openReports > 0} />
        <Stat label="Pending payouts" value={s.pendingPayouts} accent={s.pendingPayouts > 0} />
      </div>
      <Card className="mt-6">
        <CardHeader title="Recent admin actions" />
        {actions.length === 0 ? <p className="p-5 text-sm text-faint">No actions yet.</p> : (
          <div className="divide-y divide-line text-sm">
            {actions.map(({ a, adminName }) => (
              <div key={a.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                <span><span className="font-medium">{adminName}</span> · {a.action} · <span className="font-mono text-xs text-muted">{a.targetType}:{a.targetId.slice(0, 8)}</span></span>
                <span className="text-faint">{fmtDateTime(a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
