import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { safeEqualStr } from "@/lib/codes";
import { runBookingMaintenance } from "@/lib/services/bookings";

/** Expire stale requests and send reminders. Call every few minutes with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !safeEqualStr(auth, `Bearer ${config.cronSecret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runBookingMaintenance());
}
