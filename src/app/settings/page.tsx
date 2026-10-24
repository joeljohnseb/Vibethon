import { requireUserPage } from "@/lib/auth/session";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { changePasswordAction, signOutEverywhereAction } from "@/app/actions/account";
import { RoleSwitch } from "@/components/nav-client";
import { Button, Card, CardHeader, inputClass, PageHeader } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";

export const metadata = { title: "Account settings" };

export default async function Settings() {
  const user = await requireUserPage("/settings");
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader title="Account settings" />
      <Card>
        <CardHeader title="Mode" subtitle="One account, two roles. Switch to see driver or host navigation and dashboards." />
        <div className="p-5"><div className="max-w-xs"><RoleSwitch role={user.activeRole} full /></div></div>
      </Card>

      <Card className="mt-5">
        <CardHeader title={user.passwordHash ? "Change password" : "Set a password"} subtitle={user.passwordHash ? undefined : "You signed up with Google or phone. Add a password to also sign in with email."} />
        <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4 p-5">
          {user.passwordHash && (
            <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Current password</span><input name="current" type="password" autoComplete="current-password" className={inputClass} /></label>
          )}
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">New password</span><input name="password" type="password" autoComplete="new-password" className={inputClass} /></label>
          <SubmitButton variant="secondary">Update password</SubmitButton>
        </ActionForm>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Sessions" />
        <div className="flex flex-wrap gap-2 p-5">
          <form action={logoutAction}><Button variant="secondary">Sign out</Button></form>
          <form action={signOutEverywhereAction}><Button variant="danger">Sign out on all devices</Button></form>
        </div>
      </Card>
    </div>
  );
}
