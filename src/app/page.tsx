import Link from "next/link";
import { ArrowRight, BadgeCheck, BatteryCharging, CreditCard, KeyRound, MapPin, ShieldCheck, Star, Zap } from "lucide-react";
import { buttonClass, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(46,232,138,.14),transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-volt/25 bg-volt/5 px-3 py-1 text-xs font-medium text-volt">
              <Zap size={12} /> Home charging, shared across India
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Charge at a home <br className="hidden sm:block" />
              <span className="text-volt">near you.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Public chargers busy, broken or too far? Eber lets you book a private home charger from a verified neighbour, start with a one-time code, and pay only for the energy your battery gained.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/chargers" className={buttonClass("primary", "lg")}>
                <MapPin size={18} /> Find a charger
              </Link>
              <Link href={user ? "/host/chargers/new" : "/register?role=giver"} className={buttonClass("outline", "lg")}>
                Earn from your charger <ArrowRight size={18} />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-2"><BadgeCheck size={16} className="text-volt" /> Phone-verified hosts</span>
              <span className="flex items-center gap-2"><ShieldCheck size={16} className="text-volt" /> Exact address only after confirmation</span>
              <span className="flex items-center gap-2"><CreditCard size={16} className="text-volt" /> UPI, cards &amp; net banking</span>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-volt">How it works</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">From search to paid, in four steps</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: MapPin, t: "Find nearby", d: "Map-first search with distance, ₹/kWh, power, connector and open slots." },
            { icon: BadgeCheck, t: "Book a slot", d: "Request a time with your vehicle. The host approves and you get the address." },
            { icon: KeyRound, t: "Start with a code", d: "Show your one-time code on arrival. The host verifies it and logs your battery %." },
            { icon: CreditCard, t: "Pay what you used", d: "Bill is calculated from battery gained. Pay by UPI — verified by the gateway." },
          ].map((s, i) => (
            <Card key={s.t} className="p-5">
              <div className="flex items-center justify-between">
                <div className="grid size-10 place-items-center rounded-xl bg-volt/10 text-volt">
                  <s.icon size={20} />
                </div>
                <span className="font-display text-3xl font-bold text-line-strong">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Transparent pricing */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Card className="grid gap-8 overflow-hidden p-6 md:grid-cols-2 md:p-10">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-volt">Transparent pricing</div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">You see the maths, every time</h2>
            <p className="mt-3 text-muted">
              The host records your battery percentage at the start and end. Eber&apos;s server calculates the energy your battery gained using your vehicle&apos;s capacity, multiplied by the price you agreed when you booked.
            </p>
            <p className="mt-3 text-sm text-faint">
              This is an estimate of energy stored in the battery. Electricity drawn from the wall is usually a little higher because of charging losses. Any platform fee or tax is shown as its own line before you pay.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-bg p-5 font-mono text-sm">
            <div className="text-faint">{"// example"}</div>
            <div className="mt-3 space-y-2">
              <Row k="Battery capacity" v="60 kWh" />
              <Row k="Battery at start → end" v="30% → 70%" />
              <Row k="Energy gained" v="60 × 40% = 24 kWh" />
              <Row k="Host's price" v="₹12.00 / kWh" />
              <div className="my-3 border-t border-dashed border-line-strong" />
              <Row k="Total payable" v="₹288.00" strong />
            </div>
          </div>
        </Card>
      </section>

      {/* Hosts */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-volt">For homeowners</div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Your charger sits idle most of the day. Put it to work.</h2>
            <ul className="mt-6 space-y-4">
              {[
                ["Set your own price and hours", "Choose ₹/kWh, weekly availability and block days off."],
                ["Approve every booking", "See the driver's vehicle and rating before you accept."],
                ["Earnings you can track", "Each paid session adds to your balance; request a payout anytime."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <BatteryCharging className="mt-0.5 shrink-0 text-volt" size={20} />
                  <div>
                    <div className="font-medium">{t}</div>
                    <div className="text-sm text-muted">{d}</div>
                  </div>
                </li>
              ))}
            </ul>
            <Link href={user ? "/host/chargers/new" : "/register?role=giver"} className={buttonClass("primary", "lg") + " mt-8"}>
              List your charger
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["Drivers rate hosts", <Star key="s" size={18} />],
              ["Hosts rate drivers", <Star key="t" size={18} />],
              ["Single-use start codes", <KeyRound key="k" size={18} />],
              ["Verified payments", <ShieldCheck key="v" size={18} />],
            ].map(([t, icon]) => (
              <Card key={String(t)} className="flex aspect-[4/3] flex-col justify-between p-5">
                <div className="text-volt">{icon}</div>
                <div className="font-display font-semibold">{t}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className={strong ? "text-lg font-bold text-volt" : "text-ink"}>{v}</span>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-8 rounded-[3rem] bg-volt/10 blur-3xl" />
      <div className="relative rounded-[2rem] border border-line-strong bg-surface p-3 shadow-2xl shadow-black/60">
        <div className="rounded-[1.5rem] border border-line bg-bg p-5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Booking EBR-7K3Q9X</span>
            <span className="flex items-center gap-1.5 text-volt"><span className="size-1.5 rounded-full bg-volt" /> Confirmed</span>
          </div>
          <div className="mt-4 font-display text-lg font-semibold">Covered driveway charger</div>
          <div className="text-sm text-muted">Indiranagar · Today 6:00 – 8:00 PM</div>
          <div className="mt-6 rounded-2xl border border-volt/30 bg-volt/5 p-4 text-center">
            <div className="text-xs uppercase tracking-widest text-muted">Your start code</div>
            <div className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-volt">482 917</div>
            <div className="mt-2 text-xs text-faint">Show this to your host · expires in 9:42</div>
          </div>
          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">Charger</span><span>7.4 kW · Type 2</span></div>
            <div className="flex justify-between"><span className="text-muted">Agreed price</span><span>₹12.00/kWh</span></div>
            <div className="flex justify-between"><span className="text-muted">Vehicle</span><span>Nexon EV · 40.5 kWh</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
