import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForms } from "@/components/auth-forms";
import { Card, Notice } from "@/components/ui";
import { getCurrentUser, safeNext } from "@/lib/auth/session";
import { config } from "@/lib/config";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured on this server yet.",
  google_state: "Your Google sign-in expired. Please try again.",
  google_failed: "We couldn't sign you in with Google. Please try again.",
  suspended: "This account is suspended. Contact support.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = sp.next ? safeNext(sp.next) : undefined;
  if (await getCurrentUser()) redirect(next ?? "/");
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-muted">Sign in to book chargers or manage your listing.</p>
      {sp.error && ERRORS[sp.error] && <Notice tone="danger" className="mt-5">{ERRORS[sp.error]}</Notice>}
      <Card className="mt-6 p-6">
        <LoginForms next={next} googleEnabled={config.google.enabled} smsSandbox={config.sms.mode === "sandbox"} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        New to Eber?{" "}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-volt hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
