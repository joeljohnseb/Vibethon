import { BadgeCheck, CalendarCheck, CreditCard, KeyRound, MapPin, PlugZap, Star, Wallet } from "lucide-react";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "How Eber works" };

const driver = [
  { icon: MapPin, t: "Discover", d: "Search by your location or any area. Filter by distance, price, connector, charging speed and open time slots. Pins show approximate locations." },
  { icon: CalendarCheck, t: "Book", d: "Pick a date, start time and duration, and the vehicle you're bringing. Incompatible chargers and taken slots can't be booked. Your price is locked in." },
  { icon: BadgeCheck, t: "Get confirmed", d: "The host approves (or the listing auto-confirms). You get a booking reference, the exact address, arrival instructions and the host's number." },
  { icon: KeyRound, t: "Start with your code", d: "On arrival, open your booking and show your single-use start code. The host enters it and records your starting battery %." },
  { icon: CreditCard, t: "Pay what you gained", d: "When you're done, the host records the ending battery %. Eber calculates the bill and you pay by UPI, card or net banking." },
  { icon: Star, t: "Review", d: "After verified payment, you and the host can review each other. Ratings help everyone choose with confidence." },
];
const host = [
  { icon: PlugZap, t: "List your charger", d: "Add photos, connectors, power, price per kWh, parking and access details. Verify your phone, set weekly hours and publish." },
  { icon: CalendarCheck, t: "Approve requests", d: "See each driver's vehicle and rating, then approve or decline. Confirmed bookings automatically block their time slots." },
  { icon: KeyRound, t: "Run the session", d: "Verify the driver's code, record their starting battery %, and the ending % when they're done. Eber sends them the bill." },
  { icon: Wallet, t: "Get paid", d: "Each verified payment adds to your earnings. Request a payout whenever you like and track it to completion." },
];

function Steps({ items }: { items: typeof driver }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s, i) => (
        <Card key={s.t} className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-volt/10 text-volt"><s.icon size={19} /></span>
            <span className="font-mono text-xs text-faint">STEP {i + 1}</span>
          </div>
          <h3 className="mt-3 font-display font-semibold">{s.t}</h3>
          <p className="mt-1 text-sm text-muted">{s.d}</p>
        </Card>
      ))}
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="How Eber works" title="Home charging, booked like a ride" subtitle="Eber is a marketplace between EV drivers and homeowners with chargers. One account does both — switch between Driver and Host anytime." />
      <h2 className="mb-4 mt-10 font-display text-xl font-semibold">For drivers</h2>
      <Steps items={driver} />
      <h2 className="mb-4 mt-12 font-display text-xl font-semibold">For hosts</h2>
      <Steps items={host} />
      <Card className="mt-12 p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold">About the energy estimate</h2>
        <p className="mt-2 max-w-3xl text-muted">
          Most home chargers don&apos;t report energy to apps, so Eber estimates billable energy from the change in battery percentage and your registered battery capacity: <span className="font-mono text-ink">capacity × (end% − start%)</span>. Electricity drawn from the wall is typically a bit higher because of charging losses — you&apos;re billed only for the battery estimate. Eber is built to switch to metered readings when a charger supports it.
        </p>
      </Card>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <LinkButton href="/chargers" size="lg">Find a charger</LinkButton>
        <LinkButton href="/register?role=giver" variant="outline" size="lg">Become a host</LinkButton>
      </div>
    </div>
  );
}
