import Link from "next/link";
import { requireUserPage } from "@/lib/auth/session";
import { ChargerForm, emptyCharger } from "@/components/charger-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Add a charger" };

export default async function NewCharger() {
  await requireUserPage("/host/chargers/new");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/host/chargers" className="text-sm text-muted hover:text-ink">← Listings</Link>
      <PageHeader title="Add your charger" subtitle="Saved as a draft. You'll set your weekly hours next, then publish." />
      <ChargerForm initial={emptyCharger} />
    </div>
  );
}
