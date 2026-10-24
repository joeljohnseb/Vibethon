import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { DISPUTE_CATEGORIES, listMyDisputes } from "@/lib/services/disputes";
import { DisputeForm } from "@/components/dispute-form";
import { Badge, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "Help & disputes" };

const FAQ = [
  ["How is my bill calculated?", "Energy gained = your vehicle's battery capacity × (ending % − starting %). That's multiplied by the price per kWh agreed when you booked. The host records the battery percentages from your car's display; Eber's server does the maths. Any configured fees appear as separate lines."],
  ["Why might the wall meter show more energy?", "Charging isn't 100% efficient — some energy is lost as heat. Eber bills the battery-energy estimate, which is usually a little lower than what the meter records."],
  ["When do I get the exact address?", "As soon as the host confirms your booking. Before that, you'll see an approximate area within about 600 m."],
  ["What's the start code for?", "It proves you're the driver who booked. Open your booking on arrival and tap “Show my start code”. It's single-use, expires after 10 minutes and only works for that booking."],
  ["What if my payment fails?", "Your session stays in “Payment failed” and you can retry from your booking with UPI, card or net banking. Sessions are marked completed only when the payment gateway confirms payment."],
  ["How do hosts get paid?", "Each paid session adds the energy charge to the host's balance. Hosts request a payout; it's shown as transferred only after the transfer is confirmed."],
  ["Can I cancel?", "Yes, before charging starts. Each listing has a cancellation policy (1, 6 or 24 hours' notice). Nothing is charged for cancelling, but late cancellations are visible to hosts."],
];

export default async function Help({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const mine = user ? await listMyDisputes(user.id) : [];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Help & disputes" subtitle="Answers to common questions, and a way to report a problem with a booking." />
      <Card>
        <CardHeader title="Frequently asked questions" />
        <div className="divide-y divide-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {q}
                <span className="text-faint transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Card>

      <Card id="report" className="mt-5 scroll-mt-24">
        <CardHeader title="Report a problem" subtitle="Billing disagreements, no-shows, access issues or safety concerns. Our team reviews every report." />
        <div className="p-5">
          {user ? (
            <DisputeForm categories={DISPUTE_CATEGORIES} bookingRef={sp.booking} />
          ) : (
            <div className="text-sm text-muted">
              <LinkButton href="/login?next=/help" size="sm">Sign in to report a problem</LinkButton>
            </div>
          )}
        </div>
      </Card>

      {mine.length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Your reports" />
          <div className="divide-y divide-line">
            {mine.map(({ d, reference }) => (
              <div key={d.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{DISPUTE_CATEGORIES[d.category as keyof typeof DISPUTE_CATEGORIES] ?? d.category}{reference && <span className="font-mono text-xs text-muted"> · {reference}</span>}</div>
                  <Badge tone={d.status === "resolved" ? "volt" : d.status === "dismissed" ? "neutral" : "warn"}>{d.status}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-muted">{d.description}</p>
                {d.resolution && <p className="mt-1 text-volt">Eber: {d.resolution}</p>}
                <div className="mt-1 text-xs text-faint">{fmtDate(d.createdAt)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <p className="mt-6 text-center text-sm text-faint">
        Safety emergency? Call 112. See our <Link href="/safety" className="underline">safety guidelines</Link>.
      </p>
    </div>
  );
}
