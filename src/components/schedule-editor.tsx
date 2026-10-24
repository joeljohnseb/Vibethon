"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./action-form";
import { saveAvailabilityAction } from "@/app/actions/host";
import { cn } from "@/lib/utils";

type Rule = { weekday: number; startMinute: number; endMinute: number };
const DAYS = [1, 2, 3, 4, 5, 6, 0];
const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const toHHMM = (m: number) => (m === 1440 ? "24:00" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const toMin = (s: string) => {
  if (s === "24:00") return 1440;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const OPTIONS = Array.from({ length: 49 }, (_, i) => i * 30);

const PRESETS: { label: string; rules: () => Rule[] }[] = [
  { label: "Every day, 24 hours", rules: () => DAYS.map((d) => ({ weekday: d, startMinute: 0, endMinute: 1440 })) },
  { label: "Every day, 8 am – 10 pm", rules: () => DAYS.map((d) => ({ weekday: d, startMinute: 480, endMinute: 1320 })) },
  { label: "Weekdays 9–6, weekends all day", rules: () => DAYS.map((d) => (d === 0 || d === 6 ? { weekday: d, startMinute: 0, endMinute: 1440 } : { weekday: d, startMinute: 540, endMinute: 1080 })) },
  { label: "Evenings & nights, 6 pm – midnight", rules: () => DAYS.map((d) => ({ weekday: d, startMinute: 1080, endMinute: 1440 })) },
];

export function ScheduleEditor({ chargerId, initial }: { chargerId: string; initial: Rule[] }) {
  const [rules, setRules] = useState<Rule[]>(initial);
  const byDay = (d: number) => rules.map((r, i) => ({ ...r, i })).filter((r) => r.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
  const update = (i: number, patch: Partial<Rule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = (d: number) => {
    const last = byDay(d).at(-1);
    const start = last ? Math.min(last.endMinute + 60, 1380) : 540;
    setRules((rs) => [...rs, { weekday: d, startMinute: start, endMinute: Math.min(start + 240, 1440) }]);
  };
  const copyToAll = (d: number) => {
    const src = byDay(d);
    setRules(DAYS.flatMap((day) => src.map((r) => ({ weekday: day, startMinute: r.startMinute, endMinute: r.endMinute }))));
  };
  const sel = "h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm outline-none focus:border-volt";

  return (
    <ActionForm action={saveAvailabilityAction}>
      <input type="hidden" name="chargerId" value={chargerId} />
      <input type="hidden" name="rules" value={JSON.stringify(rules.map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute })))} />
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => setRules(p.rules())} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted hover:border-volt hover:text-volt">
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => setRules([])} className="rounded-full px-3 py-1.5 text-xs text-faint hover:text-danger">Clear all</button>
      </div>
      <div className="divide-y divide-line rounded-xl border border-line">
        {DAYS.map((d) => {
          const list = byDay(d);
          return (
            <div key={d} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
              <div className="w-28 shrink-0 pt-1.5 text-sm font-medium">{NAMES[d]}</div>
              <div className="flex-1 space-y-2">
                {list.length === 0 && <div className="pt-1.5 text-sm text-faint">Unavailable</div>}
                {list.map((r) => {
                  const bad = r.startMinute >= r.endMinute;
                  return (
                    <div key={r.i} className="flex flex-wrap items-center gap-2">
                      <select aria-label="From" value={toHHMM(r.startMinute)} onChange={(e) => update(r.i, { startMinute: toMin(e.target.value) })} className={cn(sel, bad && "border-danger")}>
                        {OPTIONS.slice(0, -1).map((m) => <option key={m} value={toHHMM(m)}>{toHHMM(m)}</option>)}
                      </select>
                      <span className="text-faint">to</span>
                      <select aria-label="To" value={toHHMM(r.endMinute)} onChange={(e) => update(r.i, { endMinute: toMin(e.target.value) })} className={cn(sel, bad && "border-danger")}>
                        {OPTIONS.slice(1).map((m) => <option key={m} value={toHHMM(m)}>{toHHMM(m)}</option>)}
                      </select>
                      <button type="button" aria-label="Remove window" onClick={() => setRules((rs) => rs.filter((_, j) => j !== r.i))} className="grid size-9 place-items-center rounded-lg text-faint hover:text-danger">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => add(d)} className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted hover:text-volt"><Plus size={14} /> Add</button>
                {list.length > 0 && <button type="button" onClick={() => copyToAll(d)} title="Copy to all days" className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-faint hover:text-ink"><Copy size={13} /> All days</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <SubmitButton pendingText="Saving…">Save weekly hours</SubmitButton>
      </div>
    </ActionForm>
  );
}
