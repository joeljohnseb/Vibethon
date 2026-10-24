import Link from "next/link";
import { requireUserPage, safeNext } from "@/lib/auth/session";
import { listVehicles } from "@/lib/services/vehicles";
import { config } from "@/lib/config";
import { AddVehicleForm, PhoneVerification, ProfileForm, VehicleCard } from "@/components/profile-forms";
import { Card, CardHeader, LinkButton, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Profile & vehicles" };

export default async function Profile({ searchParams }: { searchParams: Promise<{ welcome?: string; next?: string }> }) {
  const user = await requireUserPage("/profile");
  const sp = await searchParams;
  const vehicles = await listVehicles(user.id);
  const next = sp.next ? safeNext(sp.next) : null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Profile & vehicles" subtitle="Your details, phone verification and the EVs you charge." />
      {sp.welcome && <Notice tone="volt" className="mb-5" title="Welcome to Eber!">Add your vehicle so we can show compatible chargers and estimate your costs.</Notice>}
      {next && vehicles.length > 0 && (
        <Notice tone="info" className="mb-5"><Link href={next} className="font-semibold underline">Continue where you left off →</Link></Notice>
      )}

      <Card id="vehicles" className="scroll-mt-24">
        <CardHeader title="My vehicles" subtitle="Battery capacity is used to calculate the energy you're billed for." />
        <div className="space-y-3 p-5">
          {vehicles.map((v) => <VehicleCard key={v.id} v={v} />)}
          <AddVehicleForm open={vehicles.length === 0} />
        </div>
      </Card>

      <Card id="phone" className="mt-5 scroll-mt-24">
        <CardHeader title="Phone verification" subtitle="Required for hosts before publishing. Lets you sign in with an OTP." />
        <div className="p-5">
          <PhoneVerification phone={user.phone} verified={Boolean(user.phoneVerifiedAt)} sandbox={config.sms.mode === "sandbox"} />
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Profile" />
        <div className="p-5">
          <ProfileForm name={user.name} email={user.email} />
        </div>
      </Card>

      <div className="mt-5 flex justify-end">
        <LinkButton href="/settings" variant="ghost" size="sm">Account settings →</LinkButton>
      </div>
    </div>
  );
}
