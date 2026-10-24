"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { buttonClass } from "./ui";
import { useSubmitting } from "./action-form";

/** Two-step submit button: first click asks for confirmation inline. */
export function ConfirmButton({
  children,
  confirmText = "Are you sure?",
  confirmLabel = "Yes, continue",
  variant = "danger",
  size = "md",
  full,
}: {
  children: ReactNode;
  confirmText?: string;
  confirmLabel?: string;
  variant?: "primary" | "danger" | "secondary";
  size?: "sm" | "md";
  full?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const pending = useSubmitting();
  if (!asking)
    return (
      <button type="button" onClick={() => setAsking(true)} className={buttonClass(variant === "primary" ? "primary" : variant === "secondary" ? "secondary" : "danger", size, full)}>
        {children}
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">{confirmText}</span>
      <button type="submit" disabled={pending} className={buttonClass(variant, "sm")}>
        {pending ? <Loader2 size={14} className="animate-spin" /> : null}
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className={buttonClass("ghost", "sm")}>
        Keep it
      </button>
    </div>
  );
}
