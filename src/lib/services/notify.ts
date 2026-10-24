import { eq } from "drizzle-orm";
import { db, type Executor } from "@/lib/db";
import { auditLogs, notifications, users } from "@/lib/db/schema";
import { config } from "@/lib/config";

export type NotificationType =
  | "booking_request"
  | "booking_approved"
  | "booking_rejected"
  | "booking_cancelled"
  | "booking_expired"
  | "session_upcoming"
  | "session_started"
  | "session_ended"
  | "session_completed"
  | "payment_succeeded"
  | "payment_failed"
  | "review_received"
  | "payout_update"
  | "dispute_update"
  | "listing_update";

export async function notify(
  ex: Executor,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
) {
  await ex.insert(notifications).values({ userId, type, title, body, link });
  if (config.email.resendKey) void sendEmail(userId, title, body, link);
}

/** Best-effort email copy of a notification (only when RESEND_API_KEY is configured). */
async function sendEmail(userId: string, subject: string, body: string, link?: string) {
  try {
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    if (!u?.email) return;
    const url = link ? `${config.appUrl}${link}` : config.appUrl;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.email.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.email.from, to: u.email, subject, text: `${body}\n\n${url}` }),
    });
  } catch (e) {
    console.warn("[eber] email send failed", e);
  }
}

export async function audit(
  ex: Executor,
  entry: {
    actorId?: string | null;
    entityType: "booking" | "session" | "payment" | "invoice" | "charger" | "payout" | "user" | "review";
    entityId: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  await ex.insert(auditLogs).values({ ...entry, actorId: entry.actorId ?? null });
}
