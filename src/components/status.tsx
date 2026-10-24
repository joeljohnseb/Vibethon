import { Badge, Dot } from "./ui";
import { bookingStatusLabel, sessionStatusLabel, type BookingStatus, type SessionStatus } from "@/lib/state";

export function bookingDisplay(status: BookingStatus, session?: SessionStatus | null): { label: string; tone: "neutral" | "volt" | "warn" | "danger" | "info" } {
  if (status === "confirmed" && session && session !== "awaiting_start") {
    const tone = session === "active" ? "volt" : session === "payment_failed" ? "danger" : "warn";
    return { label: sessionStatusLabel[session], tone };
  }
  const tone = ({ pending: "warn", confirmed: "info", completed: "volt", rejected: "danger", cancelled: "neutral", expired: "neutral" } as const)[status];
  return { label: bookingStatusLabel[status], tone };
}

export function BookingStatusPill({ status, session }: { status: BookingStatus; session?: SessionStatus | null }) {
  const d = bookingDisplay(status, session);
  return (
    <Badge tone={d.tone}>
      {(d.tone === "volt" && session === "active") ? <Dot /> : null}
      {d.label}
    </Badge>
  );
}
