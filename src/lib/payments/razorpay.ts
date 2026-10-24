import "server-only";
import { config } from "@/lib/config";
import { hmac, safeEqualHex } from "@/lib/codes";
import { AppError } from "@/lib/errors";

const API = "https://api.razorpay.com/v1";
const auth = () =>
  `Basic ${Buffer.from(`${config.payments.razorpayKeyId}:${config.payments.razorpayKeySecret}`).toString("base64")}`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: auth(), "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[eber:razorpay]", res.status, body.slice(0, 500));
    throw new AppError("PAYMENT", "The payment gateway is unavailable right now. Please try again.");
  }
  return (await res.json()) as T;
}

export type RzpOrder = { id: string; amount: number; currency: string; status: string; receipt: string };
export type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; method?: string; error_description?: string };

export function createOrder(amountPaise: number, receipt: string, notes: Record<string, string>) {
  return call<RzpOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: receipt.slice(0, 40), notes, payment_capture: 1 }),
  });
}

export const fetchPayment = (id: string) => call<RzpPayment>(`/payments/${encodeURIComponent(id)}`);
export const fetchOrderPayments = (orderId: string) =>
  call<{ items: RzpPayment[] }>(`/orders/${encodeURIComponent(orderId)}/payments`);

/** Signature returned by Checkout: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  return safeEqualHex(hmac(config.payments.razorpayKeySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  if (!config.payments.razorpayWebhookSecret) return false;
  return safeEqualHex(hmac(config.payments.razorpayWebhookSecret, rawBody), signature);
}
