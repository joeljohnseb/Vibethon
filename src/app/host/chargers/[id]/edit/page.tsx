import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/auth/session";
import { getOwnerCharger } from "@/lib/services/chargers";
import { photoUrl } from "@/lib/storage";
import { AppError } from "@/lib/errors";
import { ChargerForm } from "@/components/charger-form";
import { ListingStatusControls } from "@/components/listing-status";
import { LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Edit listing" };

export default async function EditCharger({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/host/chargers/${id}/edit`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let c;
  try {
    c = await getOwnerCharger(user.id, id);
  } catch (e) {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/host/chargers" className="text-sm text-muted hover:text-ink">← Listings</Link>
      <PageHeader title="Edit listing" subtitle={c.title} action={<LinkButton href={`/host/chargers/${id}/availability`} variant="secondary" size="sm">Availability</LinkButton>} />
      <div className="mb-5 flex justify-end"><ListingStatusControls chargerId={c.id} status={c.status} showRemove /></div>
      <ChargerForm
        initial={{
          id: c.id, title: c.title, description: c.description, addressLine: c.addressLine, locality: c.locality, city: c.city, state: c.state,
          postalCode: c.postalCode, lat: c.lat, lng: c.lng, connectors: c.connectors, powerKw: c.powerKw, pricePerKwh: c.pricePerKwhPaise / 100,
          parkingInfo: c.parkingInfo, accessInstructions: c.accessInstructions, safetyInfo: c.safetyInfo, amenities: c.amenities,
          bookingMode: c.bookingMode, cancellationPolicy: c.cancellationPolicy, slotMinutes: c.slotMinutes,
          photos: c.photos.map((p) => ({ id: p.id, url: photoUrl(p.storageKey) })),
        }}
      />
    </div>
  );
}
