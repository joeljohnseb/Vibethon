import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";
import { getCurrentUser, safeNext } from "@/lib/auth/session";
import { config } from "@/lib/config";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; role?: string }> }) {
  const sp = await searchParams;
  const next = sp.next ? safeNext(sp.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? "/");
  const role = sp.role === "giver" ? "giver" : "taker";
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{role === "giver" ? "Start hosting on Eber" : "Create your Eber account"}</h1>
      <p className="mt-1.5 text-muted">One account for charging your EV and sharing your home charger.</p>
      <Card className="mt-6 p-6">
        <RegisterForm next={next} role={role} googleEnabled={config.google.enabled} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-volt hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
