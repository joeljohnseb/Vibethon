import { CalendarClock } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { listBookings, type BookingTab } from "@/lib/services/bookings";
import { BookingRow } from "@/components/booking-parts";
import { EmptyState, LinkButton, PageHeader, Tabs } from "@/components/ui";

export const metadata = { title: "My bookings" };

const TABS: { key: BookingTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "requests", label: "Requests" },
  { key: "past", label: "History" },
  { key: "cancelled", label: "Cancelled" },
];

export default async function MyBookings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUserPage("/bookings");
  const sp = await searchParams;
  const all = await listBookings(user.id, "taker", "all");
  const counts = {
    upcoming: all.filter((r) => r.b.status === "confirmed" && r.sessionStatus === "awaiting_start").length,
    active: all.filter((r) => r.b.status === "confirmed" && r.sessionStatus && r.sessionStatus !== "awaiting_start").length,
    requests: all.filter((r) => r.b.status === "pending").length,
    past: 0,
    cancelled: 0,
    all: 0,
  };
  const fallback: BookingTab = counts.active ? "active" : counts.upcoming ? "upcoming" : counts.requests ? "requests" : "past";
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : fallback) as BookingTab;
  const rows = await listBookings(user.id, "taker", tab);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="My bookings" subtitle="Your charging requests, upcoming sessions and history." action={<LinkButton href="/chargers" size="sm">Find a charger</LinkButton>} />
      <Tabs active={tab} tabs={TABS.map((t) => ({ ...t, href: `/bookings?tab=${t.key}`, count: counts[t.key] }))} />
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarClock />} title={tab === "past" ? "No completed sessions yet" : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} bookings`} body="Find a home charger nearby and request a slot — it takes under a minute." action={<LinkButton href="/chargers">Find a charger</LinkButton>} />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <BookingRow key={r.b.id} r={r} as="taker" href={`/bookings/${r.b.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
