import Link from "next/link";
import { MapPin, Zap, Clock } from "lucide-react";
import { ChargerArt } from "./charger-art";
import { Badge, Stars } from "./ui";
import { connectorLabel } from "@/lib/constants";
import { formatPaise } from "@/lib/money";
import { fmtKm } from "@/lib/geo";
import { fmtTime, fmtDate, localDate } from "@/lib/time";
import type { ChargerSummary } from "@/lib/services/search";

function slotLabel(iso: string) {
  const d = new Date(iso);
  const today = localDate(new Date());
  const day = localDate(d);
  const tomorrow = localDate(new Date(Date.now() + 86400_000));
  const prefix = day === today ? "Today" : day === tomorrow ? "Tomorrow" : fmtDate(d).replace(/ \d{4}$/, "");
  return `${prefix}, ${fmtTime(d)}`;
}

export function ChargerCard({ c, query }: { c: ChargerSummary; query?: string }) {
  return (
    <Link
      href={`/chargers/${c.id}${query ? `?${query}` : ""}`}
      id={`charger-${c.id}`}
      className="group flex gap-4 rounded-2xl border border-line bg-surface p-3 transition hover:border-volt/40 hover:bg-surface-2"
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:h-32 sm:w-40">
        {c.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photo} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <ChargerArt seed={c.id} className="size-full" />
        )}
        {c.bookingMode === "instant" && (
          <span className="absolute left-2 top-2 rounded-md bg-volt px-1.5 py-0.5 text-[10px] font-bold uppercase text-volt-ink">Instant</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display font-semibold group-hover:text-volt">{c.title}</h3>
          <div className="shrink-0 text-right">
            <div className="font-display text-lg font-semibold leading-none text-volt">{formatPaise(c.pricePerKwhPaise, { short: true })}</div>
            <div className="text-[11px] text-faint">per kWh</div>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted">
          <MapPin size={13} /> {c.locality}, {c.city} · {fmtKm(c.distanceKm)}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>
            <Zap size={11} /> {c.powerKw} kW
          </Badge>
          {c.connectors.slice(0, 2).map((k) => (
            <Badge key={k}>{connectorLabel(k)}</Badge>
          ))}
          {c.isOwn && <Badge tone="info">Your listing</Badge>}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
          <Stars value={c.hostRating.avg} count={c.hostRating.count} />
          {c.nextSlot ? (
            <span className="flex items-center gap-1 text-volt">
              <Clock size={13} />
              {c.slotsOnDate !== null ? `${c.slotsOnDate} slot${c.slotsOnDate === 1 ? "" : "s"} · from ` : "Next: "}
              {slotLabel(c.nextSlot.start)}
            </span>
          ) : (
            <span className="text-faint">No slots this week</span>
          )}
        </div>
      </div>
    </Link>
  );
}
