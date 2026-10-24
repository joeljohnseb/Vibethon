import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/services/payments";
import { AppError } from "@/lib/errors";
import { config } from "@/lib/config";

/** Sandbox gateway webhook (test mode only). Same verification + processing path as Razorpay. */
export async function POST(req: Request) {
  if (!config.sandboxAllowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const raw = await req.text();
  try {
    const status = await handleWebhook("sandbox", raw, req.headers.get("x-sandbox-signature") ?? "", req.headers.get("x-sandbox-event-id"));
    return NextResponse.json({ status });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
