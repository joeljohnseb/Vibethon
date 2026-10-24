import Link from "next/link";
import { cn } from "@/lib/utils";
import { addDays, localDate, WEEKDAYS } from "@/lib/time";

/** Horizontally scrolling strip of the next `days` dates as links. */
export function DateStrip({ selected, hrefFor, days = 14, availableDays }: { selected: string; hrefFor: (d: string) => string; days?: number; availableDays?: Set<number> }) {
  const today = localDate(new Date());
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {Array.from({ length: days }, (_, i) => addDays(today, i)).map((d) => {
        const dt = new Date(`${d}T00:00:00Z`);
        const wd = dt.getUTCDay();
        const open = !availableDays || availableDays.has(wd);
        return (
          <Link
            key={d}
            href={hrefFor(d)}
            scroll={false}
            className={cn(
              "flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-center transition",
              d === selected ? "border-volt bg-volt text-volt-ink" : open ? "border-line bg-surface-2 hover:border-line-strong" : "border-line/50 text-faint",
            )}
          >
            <span className="text-[11px] font-medium uppercase">{d === today ? "Today" : WEEKDAYS[wd]}</span>
            <span className="font-display text-lg font-semibold leading-tight">{dt.getUTCDate()}</span>
          </Link>
        );
      })}
    </div>
  );
}
