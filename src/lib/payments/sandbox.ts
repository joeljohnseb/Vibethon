/**
 * TEST-MODE payment gateway, used only when Razorpay keys are not configured
 * (and never in production unless EBER_ALLOW_SANDBOX=true). It mimics Razorpay's
 * webhook payloads and signs them with a server-only secret, so payments flow
 * through exactly the same verification and state-transition code as real ones.
 */
import "server-only";
import { config } from "@/lib/config";
import { hmac, randomBase32, safeEqualHex } from "@/lib/codes";

export const sandboxSecret = () => hmac(config.secret, "eber-sandbox-webhook");
export const sandboxOrderId = () => `order_SBX${randomBase32(14)}`;

export type SandboxOutcome = "success" | "failure" | "pending";

export function buildSandboxEvent(orderId: string, amountPaise: number, outcome: SandboxOutcome, method = "upi") {
  const paymentId = `pay_SBX${randomBase32(14)}`;
  const event = outcome === "success" ? "payment.captured" : outcome === "failure" ? "payment.failed" : "payment.pending";
  const body = JSON.stringify({
    entity: "event",
    event,
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: amountPaise,
          currency: "INR",
          status: outcome === "success" ? "captured" : outcome === "failure" ? "failed" : "pending",
          method,
          error_description: outcome === "failure" ? "Payment declined by the test bank (sandbox)" : undefined,
        },
      },
    },
  });
  return { body, signature: hmac(sandboxSecret(), body), eventId: `evt_SBX${randomBase32(14)}` };
}

export const verifySandboxSignature = (rawBody: string, signature: string) =>
  safeEqualHex(hmac(sandboxSecret(), rawBody), signature);
