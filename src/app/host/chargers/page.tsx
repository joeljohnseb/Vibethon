import Link from "next/link";
import { CalendarDays, Eye, Pencil, PlugZap, Plus } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { listOwnerChargers } from "@/lib/services/chargers";
import { formatPaise } from "@/lib/money";
import { photoUrl } from "@/lib/storage";
import { connectorLabel } from "@/lib/constants";
import { ChargerArt } from "@/components/charger-art";
import { ListingStatusControls } from "@/components/listing-status";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Your listings" };

export default async function HostChargers() {
  const user = await requireUserPage("/host/chargers");
  const chargers = await listOwnerChargers(user.id);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader title="Your listings" subtitle="Edit details, manage availability, pause or publish." action={<LinkButton href="/host/chargers/new" size="sm"><Plus size={15} /> Add charger</LinkButton>} />
      {chargers.length === 0 ? (
        <EmptyState icon={<PlugZap />} title="No listings yet" action={<LinkButton href="/host/chargers/new">Add your charger</LinkButton>} />
      ) : (
        <div className="space-y-4">
          {chargers.map((c) => (
            <Card key={c.id} className="flex flex-col gap-4 p-4 sm:flex-row">
              <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-surface-2 sm:w-44">
                {c.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl(c.photos[0].storageKey)} alt="" className="size-full object-cover" />
                ) : (
                  <ChargerArt seed={c.id} className="size-full" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold">{c.title}</h2>
                  <Badge tone={c.status === "active" ? "volt" : c.status === "paused" ? "warn" : "neutral"}>{c.status === "active" ? "Live" : c.status === "draft" ? "Draft" : "Paused"}</Badge>
                  {c.bookingMode === "instant" && <Badge tone="info">Instant</Badge>}
                </div>
                <div className="mt-1 text-sm text-muted">{c.addressLine}, {c.locality}</div>
                <div className="mt-1 text-sm text-muted">{formatPaise(c.pricePerKwhPaise)}/kWh · {c.powerKw} kW · {c.connectors.map(connectorLabel).join(", ")}</div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <LinkButton href={`/host/chargers/${c.id}/edit`} variant="secondary" size="sm"><Pencil size={14} /> Edit</LinkButton>
                  <LinkButton href={`/host/chargers/${c.id}/availability`} variant="secondary" size="sm"><CalendarDays size={14} /> Availability</LinkButton>
                  <Link href={`/chargers/${c.id}`} className="inline-flex h-9 items-center gap-1.5 px-2 text-sm text-muted hover:text-ink"><Eye size={14} /> Preview</Link>
                  <div className="ml-auto"><ListingStatusControls chargerId={c.id} status={c.status} /></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
