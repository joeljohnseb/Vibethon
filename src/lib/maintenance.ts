import "server-only";
import { runBookingMaintenance } from "./services/bookings";

const g = globalThis as unknown as { __eberMaint?: number };

/** Run housekeeping at most once a minute per server process (also exposed at /api/cron/maintenance). */
export async function maybeRunMaintenance() {
  const now = Date.now();
  if (g.__eberMaint && now - g.__eberMaint < 60_000) return;
  g.__eberMaint = now;
  try {
    await runBookingMaintenance();
  } catch (e) {
    console.warn("[eber] maintenance failed", e);
  }
}
