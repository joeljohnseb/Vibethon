import Link from "next/link";
import { Shield } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/session";

const NAV = [
  ["/admin", "Overview"], ["/admin/users", "Users"], ["/admin/listings", "Listings"], ["/admin/bookings", "Bookings"],
  ["/admin/reports", "Review reports"], ["/admin/disputes", "Disputes"], ["/admin/payouts", "Payouts"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-warn"><Shield size={16} /> Admin console — actions are logged</div>
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted hover:text-ink">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
