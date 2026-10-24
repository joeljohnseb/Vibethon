import "server-only";
import { notFound } from "next/navigation";
import { getBookingForUser } from "./services/bookings";
import { AppError } from "./errors";

export async function loadBooking(userId: string, id: string, opts: { admin?: boolean } = {}) {
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  try {
    return await getBookingForUser(userId, id, opts);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}
