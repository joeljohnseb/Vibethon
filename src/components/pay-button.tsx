"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";
import { ActionForm, SubmitButton } from "./action-form";
import { Notice } from "./ui";
import { startCheckoutAction, verifyRazorpayAction } from "@/app/actions/bookings";
import type { ActionState } from "@/lib/action";

type Checkout = { provider: "razorpay" | "sandbox"; orderId: string; amountPaise: number; keyId?: string; invoiceNumber: string; bookingReference: string };
type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };

function loadRazorpay(): Promise<RazorpayCtor> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Razorpay?: RazorpayCtor };
    if (w.Razorpay) return resolve(w.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay failed to load")));
    s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

export function PayButton({ bookingId, label, prefill }: { bookingId: string; label: string; prefill: { name: string; email?: string | null; contact?: string | null } }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "warn" | "danger" | "volt"; text: string } | null>(null);

  const open = async (s: ActionState) => {
    const co = s.data as unknown as Checkout | undefined;
    if (!co || co.provider !== "razorpay") return;
    try {
      const Razorpay = await loadRazorpay();
      const rzp = new Razorpay({
        key: co.keyId,
        amount: co.amountPaise,
        currency: "INR",
        order_id: co.orderId,
        name: "Eber",
        description: `Charging ${co.bookingReference} · ${co.invoiceNumber}`,
        prefill: { name: prefill.name, email: prefill.email ?? undefined, contact: prefill.contact ?? undefined },
        theme: { color: "#2ee88a" },
        handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          setMsg({ tone: "warn", text: "Confirming your payment with the gateway…" });
          const res = await verifyRazorpayAction({ bookingId, orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
          if (!res.ok) setMsg({ tone: "danger", text: res.error ?? "We couldn't verify the payment yet. If money was debited, it will be confirmed automatically." });
          else if (res.data?.status === "captured") setMsg({ tone: "volt", text: "Payment confirmed!" });
          else setMsg({ tone: "warn", text: "Payment is processing. We'll update this page once the gateway confirms it." });
          router.refresh();
        },
        modal: { ondismiss: () => setMsg({ tone: "warn", text: "Payment window closed. You haven't been charged — you can try again." }) },
      });
      rzp.on("payment.failed", () => setMsg({ tone: "danger", text: "That payment attempt failed. You can retry with another method." }));
      rzp.open();
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  };

  return (
    <div>
      <ActionForm action={startCheckoutAction} onSuccess={open}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <SubmitButton size="lg" full pendingText="Opening secure checkout…">
          <Lock size={16} /> {label}
        </SubmitButton>
      </ActionForm>
      {msg && <Notice tone={msg.tone} className="mt-3">{msg.text}</Notice>}
    </div>
  );
}
