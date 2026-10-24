import Link from "next/link";
import { requireUserPage } from "@/lib/auth/session";
import { switchRoleAction } from "@/app/actions/auth";
import { Notice } from "@/components/ui";

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage("/host");
  return (
    <div>
      {user.activeRole !== "giver" && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <Notice tone="info">
            <form action={switchRoleAction} className="flex flex-wrap items-center justify-between gap-2">
              <span>You&apos;re in driver mode. Switch to host mode for host navigation.</span>
              <button name="role" value="giver" className="font-semibold underline">Switch to host</button>
            </form>
          </Notice>
        </div>
      )}
      {!user.phoneVerifiedAt && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <Notice tone="warn" title="Verify your phone to publish listings">
            Drivers need a verified contact. <Link href="/profile#phone" className="font-semibold underline">Verify your number</Link> — it takes 30 seconds.
          </Notice>
        </div>
      )}
      {children}
    </div>
  );
}
