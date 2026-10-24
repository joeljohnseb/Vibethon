import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/auth/session";
import { getOwnerCharger } from "@/lib/services/chargers";
import { loadAvailability, slotsFor } from "@/lib/services/availability";
import { AppError } from "@/lib/errors";
import { addDays, fmtDateTime, localDate, WEEKDAYS } from "@/lib/time";
import { ScheduleEditor } from "@/components/schedule-editor";
import { AddBlockForm, RemoveBlockButton } from "@/components/block-forms";
import { ListingStatusControls } from "@/components/listing-status";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Availability" };

export default async function Availability({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUserPage(`/host/chargers/${id}/availability`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let c;
  try {
    c = await getOwnerCharger(user.id, id);
  } catch (e) {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
  const today = localDate(new Date(), c.timezone);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const ctx = await loadAvailability([c.id], today, days[13], c.timezone);
  const grid = days.map((d) => {
    const slots = slotsFor(c, d, ctx);
    return { d, total: slots.length, booked: slots.filter((s) => s.reason === "booked").length, blocked: slots.filter((s) => s.reason === "blocked").length, open: slots.filter((s) => s.available).length };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/host/chargers" className="text-sm text-muted hover:text-ink">← Listings</Link>
      <PageHeader title="Availability" subtitle={c.title} action={<Badge tone={c.status === "active" ? "volt" : "warn"}>{c.status === "active" ? "Live" : c.status}</Badge>} />
      {sp.created && <Notice tone="volt" className="mb-5" title="Listing saved as a draft">Set your weekly hours below, then publish to start receiving bookings.</Notice>}

      <Card>
        <CardHeader title="Weekly hours" subtitle={`Times are in ${c.timezone === "Asia/Kolkata" ? "IST" : c.timezone}. Drivers book ${c.slotMinutes}-minute slots inside these windows.`} />
        <div className="p-5">
          <ScheduleEditor chargerId={c.id} initial={c.rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute }))} />
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display font-semibold">{c.status === "active" ? "Your listing is live" : "Ready to go live?"}</div>
            <p className="text-sm text-muted">{c.status === "active" ? "Pause anytime — confirmed bookings are kept." : "Publishing needs a verified phone number and at least one availability window."}</p>
          </div>
          <ListingStatusControls chargerId={c.id} status={c.status} />
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Next 14 days" subtitle="Confirmed bookings block their slots automatically." />
        <div className="grid grid-cols-7 gap-1.5 p-4 sm:gap-2">
          {grid.map((g) => {
            const wd = new Date(`${g.d}T00:00:00Z`).getUTCDay();
            return (
              <div key={g.d} className={cn("rounded-xl border p-2 text-center", g.total ? "border-line bg-surface-2" : "border-line/50 text-faint")}>
                <div className="text-[10px] uppercase text-faint">{WEEKDAYS[wd]}</div>
                <div className="font-display font-semibold">{Number(g.d.slice(8))}</div>
                {g.total > 0 ? (
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <span className="bg-info" style={{ width: `${(g.booked / g.total) * 100}%` }} />
                    <span className="bg-warn" style={{ width: `${(g.blocked / g.total) * 100}%` }} />
                    <span className="bg-volt/60" style={{ width: `${(g.open / g.total) * 100}%` }} />
                  </div>
                ) : (
                  <div className="mt-1 text-[10px]">closed</div>
                )}
                {g.booked > 0 && <div className="mt-1 text-[10px] text-info">{g.booked} booked</div>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 border-t border-line px-5 py-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-info" /> Booked</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warn" /> Blocked</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-volt/60" /> Open</span>
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Block dates or times" subtitle="Going away or need the charger yourself? Blocked time can't be booked." />
        <div className="p-5">
          {c.blocks.length > 0 && (
            <div className="mb-5 divide-y divide-line rounded-xl border border-line">
              {c.blocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div>
                    <div>{fmtDateTime(b.startAt, c.timezone)} → {fmtDateTime(b.endAt, c.timezone)}</div>
                    {b.reason && <div className="text-xs text-faint">{b.reason}</div>}
                  </div>
                  <RemoveBlockButton chargerId={c.id} blockId={b.id} />
                </div>
              ))}
            </div>
          )}
          <AddBlockForm chargerId={c.id} today={today} />
        </div>
      </Card>
    </div>
  );
}
