import { requireAdminPage } from "@/lib/auth/session";
import { adminListUsers } from "@/lib/services/admin";
import { SuspendForm } from "@/components/admin-forms";
import { Badge, Card, inputClass, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/time";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdminPage();
  const q = (await searchParams).q?.trim();
  const users = await adminListUsers(q);
  return (
    <div>
      <PageHeader title="Users" />
      <form className="mb-4 max-w-sm"><input name="q" defaultValue={q} placeholder="Search name, email, phone" className={inputClass} /></form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-faint"><tr><th className="px-4 py-2">User</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Joined</th><th className="px-4 py-2">Flags</th><th className="px-4 py-2"></th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5"><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></td>
                <td className="px-4 py-2.5 text-muted">{u.phone ?? "—"} {u.phoneVerifiedAt && <Badge tone="volt">verified</Badge>}</td>
                <td className="px-4 py-2.5 text-muted">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-2.5 space-x-1">{u.isAdmin && <Badge tone="info">admin</Badge>}{u.suspendedAt && <Badge tone="danger">suspended</Badge>}</td>
                <td className="px-4 py-2.5 text-right">{u.id !== me.id && <SuspendForm userId={u.id} suspended={Boolean(u.suspendedAt)} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
