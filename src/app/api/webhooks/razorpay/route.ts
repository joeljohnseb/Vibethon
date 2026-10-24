import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/services/payments";
import { AppError } from "@/lib/errors";

/** Razorpay webhook. Configure in the Razorpay dashboard with events: payment.captured, payment.failed, payment.authorized, order.paid. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  try {
    const status = await handleWebhook("razorpay", raw, signature, req.headers.get("x-razorpay-event-id"));
    return NextResponse.json({ status });
  } catch (e) {
    if (e instanceof AppError && (e.code === "FORBIDDEN" || e.code === "VALIDATION")) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[eber:webhook:razorpay]", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // gateway will retry
  }
}
