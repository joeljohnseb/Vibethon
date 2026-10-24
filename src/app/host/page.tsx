import Link from "next/link";
import { ArrowRight, BatteryCharging, CalendarClock, Inbox, PlugZap, Plus } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { listBookings } from "@/lib/services/bookings";
import { listOwnerChargers } from "@/lib/services/chargers";
import { earningsSummary } from "@/lib/services/earnings";
import { userRatings } from "@/lib/services/ratings";
import { formatPaise } from "@/lib/money";
import { fmtRange } from "@/lib/time";
import { BookingRow } from "@/components/booking-parts";
import { DecisionButtons } from "@/components/host-actions";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Section, Stat, Stars } from "@/components/ui";

export const metadata = { title: "Host dashboard" };

export default async function HostDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUserPage("/host");
  const sp = await searchParams;
  const [requests, upcoming, active, chargers, earnings, ratings] = await Promise.all([
    listBookings(user.id, "giver", "requests"),
    listBookings(user.id, "giver", "upcoming"),
    listBookings(user.id, "giver", "active"),
    listOwnerChargers(user.id),
    earningsSummary(user.id),
    userRatings([user.id], "taker_to_giver"),
  ]);
  const rating = ratings.get(user.id) ?? { avg: null, count: 0 };

  if (!chargers.length)
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader eyebrow={sp.welcome ? "Welcome to Eber" : "Host dashboard"} title="List your home charger" subtitle="Share your charger when it's idle and earn from every session. It takes about five minutes." />
        <EmptyState
          icon={<PlugZap />}
          title="You haven't listed a charger yet"
          body="Add photos, connector type, power and price. Then set the hours you're available. You approve every booking."
          action={<LinkButton href="/host/chargers/new"><Plus size={16} /> Add your charger</LinkButton>}
        />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} subtitle="Here's what's happening with your chargers." action={<LinkButton href="/host/chargers/new" variant="secondary" size="sm"><Plus size={15} /> Add charger</LinkButton>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pending requests" value={requests.length} hint={requests.length ? "Respond soon" : "All caught up"} accent={requests.length > 0} />
        <Stat label="Upcoming" value={upcoming.length} hint="Confirmed sessions" />
        <Stat label="Unpaid balance" value={formatPaise(earnings.unpaid, { short: true })} hint={<Link href="/host/earnings" className="underline">Earnings & payouts</Link>} />
        <Stat label="Your rating" value={rating.avg ? `${rating.avg.toFixed(1)} ★` : "—"} hint={`${rating.count} review${rating.count === 1 ? "" : "s"}`} />
      </div>

      {active.length > 0 && (
        <Section title="Active sessions" className="mt-8">
          <div className="space-y-3">
            {active.map((r) => (
              <Link key={r.b.id} href={`/host/bookings/${r.b.id}`} className="flex items-center gap-4 rounded-2xl border border-volt/40 bg-volt/5 p-4">
                <BatteryCharging className="text-volt" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.takerName} · {r.chargerTitle}</div>
                  <div className="text-sm text-muted">{r.b.reference} · {fmtRange(r.b.startAt, r.b.endAt, r.tz)}</div>
                </div>
                <Badge tone={r.sessionStatus === "active" ? "volt" : "warn"}>{r.sessionStatus === "active" ? "Charging" : r.sessionStatus?.replace("_", " ")}</Badge>
                <ArrowRight size={16} className="text-muted" />
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Booking requests" className="mt-8" action={<Link href="/host/bookings?tab=requests" className="text-sm text-muted hover:text-ink">View all</Link>}>
        {requests.length === 0 ? (
          <Card className="flex items-center gap-3 p-5 text-sm text-muted"><Inbox size={18} /> No pending requests right now.</Card>
        ) : (
          <div className="space-y-3">
            {requests.slice(0, 5).map((r) => (
              <Card key={r.b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <Link href={`/host/bookings/${r.b.id}`} className="min-w-0 flex-1">
                  <div className="font-medium">{r.takerName} <span className="text-sm font-normal text-muted">· {r.b.vehicleLabel}</span></div>
                  <div className="text-sm text-muted">{r.chargerTitle} · {fmtRange(r.b.startAt, r.b.endAt, r.tz)}</div>
                  {r.b.takerNote && <div className="mt-1 text-sm italic text-muted">“{r.b.takerNote}”</div>}
                </Link>
                <DecisionButtons bookingId={r.b.id} />
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Upcoming sessions" className="mt-8" action={<Link href="/host/bookings?tab=upcoming" className="text-sm text-muted hover:text-ink">View all</Link>}>
        {upcoming.length === 0 ? (
          <Card className="flex items-center gap-3 p-5 text-sm text-muted"><CalendarClock size={18} /> No confirmed sessions coming up.</Card>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 5).map((r) => <BookingRow key={r.b.id} r={r} as="giver" href={`/host/bookings/${r.b.id}`} />)}
          </div>
        )}
      </Section>

      <Section title="Your listings" className="mt-8" action={<Link href="/host/chargers" className="text-sm text-muted hover:text-ink">Manage</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {chargers.map((c) => (
            <Link key={c.id} href={`/host/chargers/${c.id}/edit`} className="rounded-2xl border border-line bg-surface p-4 hover:border-line-strong">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate font-medium">{c.title}</div>
                <Badge tone={c.status === "active" ? "volt" : c.status === "paused" ? "warn" : "neutral"}>{c.status === "active" ? "Live" : c.status}</Badge>
              </div>
              <div className="mt-1 text-sm text-muted">{c.locality} · {formatPaise(c.pricePerKwhPaise, { short: true })}/kWh · {c.powerKw} kW</div>
            </Link>
          ))}
        </div>
        <div className="mt-3"><Stars value={rating.avg} count={rating.count} /></div>
      </Section>
    </div>
  );
}
