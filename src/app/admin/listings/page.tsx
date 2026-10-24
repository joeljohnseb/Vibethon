import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { adminListChargers } from "@/lib/services/admin";
import { ChargerStatusForm } from "@/components/admin-forms";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatPaise } from "@/lib/money";

export default async function AdminListings() {
  await requireAdminPage();
  const rows = await adminListChargers();
  return (
    <div>
      <PageHeader title="Listings" />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-faint"><tr><th className="px-4 py-2">Listing</th><th className="px-4 py-2">Host</th><th className="px-4 py-2">Price</th><th className="px-4 py-2">Status</th><th className="px-4 py-2"></th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ c, ownerName, ownerEmail }) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5"><Link href={`/chargers/${c.id}`} className="font-medium hover:text-volt">{c.title}</Link><div className="text-xs text-muted">{c.locality}, {c.city}</div></td>
                <td className="px-4 py-2.5"><div>{ownerName}</div><div className="text-xs text-muted">{ownerEmail}</div></td>
                <td className="px-4 py-2.5">{formatPaise(c.pricePerKwhPaise)}/kWh</td>
                <td className="px-4 py-2.5"><Badge tone={c.status === "active" ? "volt" : c.status === "removed" ? "danger" : "warn"}>{c.status}</Badge></td>
                <td className="px-4 py-2.5"><ChargerStatusForm chargerId={c.id} status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
