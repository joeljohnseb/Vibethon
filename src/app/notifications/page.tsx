import { Bell, CalendarCheck, CalendarX, CreditCard, KeyRound, Star, Wallet } from "lucide-react";
import { requireUserPage } from "@/lib/auth/session";
import { listNotifications } from "@/lib/services/notifications";
import { markNotificationsReadAction } from "@/app/actions/account";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Notifications" };

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  booking_request: CalendarCheck, booking_approved: CalendarCheck, booking_rejected: CalendarX, booking_cancelled: CalendarX, booking_expired: CalendarX,
  session_upcoming: Bell, session_started: KeyRound, session_ended: CreditCard, session_completed: Star, payment_succeeded: CreditCard, payment_failed: CreditCard,
  review_received: Star, payout_update: Wallet,
};

export default async function Notifications() {
  const user = await requireUserPage("/notifications");
  const items = await listNotifications(user.id);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up"}
        action={unread ? <form action={markNotificationsReadAction}><Button variant="secondary" size="sm">Mark all read</Button></form> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title="No notifications yet" body="Booking requests, approvals, session updates and payments will show up here." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const bad = n.type.includes("failed") || n.type.includes("rejected") || n.type.includes("cancelled");
            const body = (
              <div className={cn("flex gap-3 px-4 py-3.5", !n.readAt && "bg-volt/[0.04]")}>
                <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", bad ? "bg-danger/10 text-danger" : "bg-volt/10 text-volt")}><Icon size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn("text-sm", !n.readAt ? "font-semibold" : "font-medium")}>{n.title}</div>
                    {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-volt" />}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <div className="mt-1 text-xs text-faint">{fmtDateTime(n.createdAt)}</div>
                </div>
              </div>
            );
            return n.link ? (
              <a key={n.id} href={`/notifications/${n.id}`} className="block hover:bg-surface-2">{body}</a>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
