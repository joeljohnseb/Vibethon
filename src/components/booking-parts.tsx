import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Card, KV } from "./ui";
import { BookingStatusPill } from "./status";
import { ChargerArt } from "./charger-art";
import { formatKwh, formatPaise } from "@/lib/money";
import { connectorLabel } from "@/lib/constants";
import { fmtDateTime, fmtRange, fmtTime } from "@/lib/time";
import type { BookingDetail, BookingListRow } from "@/lib/services/bookings";
import type { BookingStatus, SessionStatus } from "@/lib/state";
import { cn } from "@/lib/utils";

export function BookingHeader({ d }: { d: BookingDetail }) {
  const b = d.booking;
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {d.charger.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.charger.photo} alt="" className="size-full object-cover" />
          ) : (
            <ChargerArt seed={d.charger.id} className="size-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{b.reference}</span>
            <BookingStatusPill status={b.status as BookingStatus} session={d.session?.status as SessionStatus | undefined} />
          </div>
          <div className="mt-1 truncate font-display text-lg font-semibold">{d.charger.title}</div>
          <div className="text-sm text-muted">{fmtRange(b.startAt, b.endAt, d.charger.timezone)}</div>
        </div>
      </div>
      <dl className="grid border-t border-line px-4 sm:grid-cols-2 sm:gap-x-8">
        <KV k="Vehicle" v={b.vehicleLabel} />
        <KV k="Battery capacity" v={`${b.vehicleBatteryKwh} kWh`} />
        <KV k="Connector" v={connectorLabel(b.connector)} />
        <KV k="Agreed price" v={`${formatPaise(b.pricePerKwhPaise)}/kWh`} />
        <KV k={d.role === "taker" ? "Host" : "Driver"} v={d.role === "taker" ? d.giver.name.split(" ")[0] : d.taker.name} />
        <KV k="Booked" v={fmtDateTime(b.createdAt, d.charger.timezone)} />
      </dl>
      {b.takerNote && (
        <div className="border-t border-line px-4 py-3 text-sm">
          <span className="text-muted">Driver&apos;s note: </span>“{b.takerNote}”
        </div>
      )}
      {b.decisionNote && (
        <div className="border-t border-line px-4 py-3 text-sm">
          <span className="text-muted">Host&apos;s note: </span>“{b.decisionNote}”
        </div>
      )}
    </Card>
  );
}

export function Timeline({ d }: { d: BookingDetail }) {
  const b = d.booking;
  const s = d.session;
  const tz = d.charger.timezone;
  const failed = ["rejected", "cancelled", "expired"].includes(b.status);
  const steps = [
    { label: "Requested", done: true, at: b.createdAt },
    { label: b.status === "rejected" ? "Declined" : b.status === "expired" ? "Expired" : "Confirmed", done: b.status !== "pending", at: b.decidedAt, bad: b.status === "rejected" || b.status === "expired" },
    ...(b.status === "cancelled" ? [{ label: b.lateCancellation ? "Cancelled (late)" : "Cancelled", done: true, at: b.updatedAt, bad: true }] : []),
    ...(!failed
      ? [
          { label: "Code verified", done: Boolean(s?.codeVerifiedAt), at: s?.codeVerifiedAt },
          { label: d.readings.start ? `Charging from ${d.readings.start.percent}%` : "Charging", done: Boolean(s?.startedAt), at: s?.startedAt },
          { label: d.readings.end ? `Ended at ${d.readings.end.percent}%` : "Ended", done: Boolean(s?.endedAt), at: s?.endedAt },
          { label: s?.status === "payment_failed" ? "Payment failed" : "Paid & completed", done: s?.status === "completed", at: s?.completedAt, bad: s?.status === "payment_failed" },
        ]
      : []),
  ];
  return (
    <Card className="p-5">
      <ol className="space-y-0">
        {steps.map((st, i) => (
          <li key={st.label + i} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className={cn("absolute left-[11px] top-6 h-[calc(100%-12px)] w-px", st.done ? "bg-volt/40" : "bg-line")} />}
            <span
              className={cn(
                "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border",
                st.bad ? "border-danger bg-danger/15 text-danger" : st.done ? "border-volt bg-volt text-volt-ink" : "border-line-strong bg-surface text-faint",
              )}
            >
              {st.done ? <Check size={13} strokeWidth={3} /> : <Circle size={6} className="fill-current" />}
            </span>
            <div className="-mt-0.5">
              <div className={cn("text-sm font-medium", !st.done && "text-faint", st.bad && "text-danger")}>{st.label}</div>
              {st.at && st.done && <div className="text-xs text-faint">{fmtDateTime(st.at, tz)}</div>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function BillBreakdown({ d, compact }: { d: BookingDetail; compact?: boolean }) {
  const inv = d.invoice;
  if (!inv) return null;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-faint">Start</div>
          <div className="font-display text-xl font-semibold">{inv.startPercent}%</div>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-faint">End</div>
          <div className="font-display text-xl font-semibold">{inv.endPercent}%</div>
        </div>
        <div className="rounded-xl bg-volt/10 p-3">
          <div className="text-xs text-faint">Energy gained</div>
          <div className="font-display text-xl font-semibold text-volt">{formatKwh(inv.billableWh)}</div>
        </div>
      </div>
      <div className="mt-4 divide-y divide-line">
        {inv.lines.map((l) => (
          <div key={l.code} className="flex items-start justify-between gap-4 py-2.5">
            <div>
              <div className="text-sm">{l.label}</div>
              {l.detail && !compact && <div className="text-xs text-faint">{l.detail}</div>}
            </div>
            <div className="text-sm font-medium tabular-nums">{formatPaise(l.amountPaise)}</div>
          </div>
        ))}
        <div className="flex items-center justify-between py-3">
          <div className="font-semibold">Total</div>
          <div className="font-display text-2xl font-bold text-volt tabular-nums">{formatPaise(inv.totalPaise)}</div>
        </div>
      </div>
      {!compact && (
        <p className="text-xs text-faint">
          Estimated from battery readings: {inv.batteryKwh} kWh × ({inv.endPercent}% − {inv.startPercent}%) = {formatKwh(inv.billableWh)}. Energy drawn from the wall is usually slightly higher due to charging losses; you&apos;re billed for the battery estimate only. Calculated by Eber&apos;s server at the price agreed when booking.
        </p>
      )}
    </div>
  );
}

export function BookingRow({ r, href, as }: { r: BookingListRow; href: string; as: "taker" | "giver" }) {
  const b = r.b;
  return (
    <Link href={href} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong hover:bg-surface-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted">{b.reference}</span>
          <BookingStatusPill status={b.status as BookingStatus} session={r.sessionStatus as SessionStatus | null} />
          {b.lateCancellation && <span className="text-xs text-warn">late cancellation</span>}
        </div>
        <div className="mt-1 truncate font-medium">{as === "giver" ? `${r.takerName} · ${r.chargerTitle}` : r.chargerTitle}</div>
        <div className="text-sm text-muted">
          {fmtRange(b.startAt, b.endAt, r.tz)} · {as === "taker" ? `${r.locality}, ${r.city}` : b.vehicleLabel}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-sm sm:text-right">
        {r.startPercent !== null && r.endPercent !== null && (
          <div>
            <div className="text-xs text-faint">Battery</div>
            <div>{r.startPercent}% → {r.endPercent}%{r.billableWh !== null && <span className="text-muted"> · {formatKwh(r.billableWh)}</span>}</div>
          </div>
        )}
        {r.totalPaise !== null ? (
          <div>
            <div className="text-xs text-faint">{r.invoiceStatus === "paid" ? "Paid" : "Due"}</div>
            <div className={cn("font-display font-semibold", r.invoiceStatus === "paid" ? "text-ink" : "text-warn")}>{formatPaise(r.totalPaise)}</div>
          </div>
        ) : (
          <div>
            <div className="text-xs text-faint">Rate</div>
            <div>{formatPaise(b.pricePerKwhPaise)}/kWh</div>
          </div>
        )}
      </div>
    </Link>
  );
}

export function fmtShortTime(d: Date, tz: string) {
  return fmtTime(d, tz);
}
