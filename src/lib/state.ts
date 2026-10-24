/**
 * Explicit state machines. Every status change in the services goes through
 * `assertTransition`, so an invalid jump (e.g. pending → completed) is rejected.
 */
import { AppError } from "./errors";

export type BookingStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "expired" | "completed";
export type SessionStatus =
  | "awaiting_start"
  | "active"
  | "awaiting_payment"
  | "payment_pending"
  | "payment_failed"
  | "completed";
export type PaymentStatus = "created" | "pending" | "authorized" | "captured" | "failed" | "refunded";

export const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "rejected", "cancelled", "expired"],
  confirmed: ["cancelled", "completed"],
  rejected: [],
  cancelled: [],
  expired: [],
  completed: [],
};

export const sessionTransitions: Record<SessionStatus, SessionStatus[]> = {
  awaiting_start: ["active"],
  active: ["awaiting_payment", "completed"], // → completed directly only for a ₹0 bill
  awaiting_payment: ["payment_pending", "payment_failed", "completed"],
  payment_pending: ["payment_pending", "payment_failed", "completed"],
  payment_failed: ["payment_pending", "payment_failed", "completed"],
  completed: [],
};

export const paymentTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  created: ["pending", "authorized", "captured", "failed"],
  pending: ["authorized", "captured", "failed"],
  authorized: ["captured", "failed"],
  // A later attempt on the same order can still succeed after a failure.
  failed: ["pending", "authorized", "captured"],
  captured: ["refunded"],
  refunded: [],
};

export function canTransition<S extends string>(map: Record<S, S[]>, from: S, to: S) {
  return map[from]?.includes(to) ?? false;
}

export function assertTransition<S extends string>(entity: string, map: Record<S, S[]>, from: S, to: S) {
  if (!canTransition(map, from, to)) {
    throw new AppError("INVALID_STATE", `Cannot change ${entity} from "${from}" to "${to}"`);
  }
}

export const bookingStatusLabel: Record<BookingStatus, string> = {
  pending: "Awaiting approval",
  confirmed: "Confirmed",
  rejected: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
  completed: "Completed",
};

export const sessionStatusLabel: Record<SessionStatus, string> = {
  awaiting_start: "Awaiting arrival",
  active: "Charging",
  awaiting_payment: "Awaiting payment",
  payment_pending: "Payment processing",
  payment_failed: "Payment failed",
  completed: "Completed",
};
