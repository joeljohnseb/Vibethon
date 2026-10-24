import { CalendarClock } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { listBookings, type BookingTab } from "@/lib/services/bookings";
import { BookingRow } from "@/components/booking-parts";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";

export const metadata = { title: "Bookings" };

const TABS: { key: BookingTab; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "past", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function HostBookings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUserPage("/host/bookings");
  const sp = await searchParams;
  const all = await listBookings(user.id, "giver", "all");
  const counts: Record<string, number> = {
    requests: all.filter((r) => r.b.status === "pending").length,
    upcoming: all.filter((r) => r.b.status === "confirmed" && r.sessionStatus === "awaiting_start").length,
    active: all.filter((r) => r.b.status === "confirmed" && r.sessionStatus && r.sessionStatus !== "awaiting_start").length,
  };
  const fallback = counts.active ? "active" : counts.requests ? "requests" : "upcoming";
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : fallback) as BookingTab;
  const rows = await listBookings(user.id, "giver", tab);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="Bookings" subtitle="Requests, upcoming sessions, charging in progress and history." />
      <Tabs active={tab} tabs={TABS.map((t) => ({ ...t, href: `/host/bookings?tab=${t.key}`, count: counts[t.key] }))} />
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarClock />} title={`Nothing in ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}`} body="New booking requests will appear here and in your notifications." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => <BookingRow key={r.b.id} r={r} as="giver" href={`/host/bookings/${r.b.id}`} />)}
        </div>
      )}
    </div>
  );
}
