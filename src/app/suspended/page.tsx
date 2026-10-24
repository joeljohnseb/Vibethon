import { logoutAction } from "@/app/actions/auth";
import { Button, Card } from "@/components/ui";

export default function Suspended() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Account suspended</h1>
        <p className="mt-2 text-muted">Your account has been suspended by the Eber team. If you think this is a mistake, email support@eber.local with your registered email address.</p>
        <form action={logoutAction} className="mt-6">
          <Button variant="secondary">Sign out</Button>
        </form>
      </Card>
    </div>
  );
}
