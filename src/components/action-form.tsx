"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import type { ActionState } from "@/lib/action";
import { buttonClass } from "./ui";
import { cn } from "@/lib/utils";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const StateCtx = createContext<ActionState>({ ok: false });
export const useFormState = () => useContext(StateCtx);
export const useFieldError = (name: string) => useContext(StateCtx).fieldErrors?.[name];

/** A <form> bound to a server action, with inline success / error feedback. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  onSuccess,
  showMessage = true,
  id,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (s: ActionState) => void;
  showMessage?: boolean;
  id?: string;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  const ref = useRef<HTMLFormElement>(null);
  const cb = useRef(onSuccess);
  useEffect(() => {
    cb.current = onSuccess;
  });
  useEffect(() => {
    if (state.ok && state.at) {
      if (resetOnSuccess) ref.current?.reset();
      cb.current?.(state);
    }
  }, [state, resetOnSuccess]);
  return (
    <StateCtx value={state}>
      <form ref={ref} action={formAction} className={className} id={id} noValidate>
        {children}
        {showMessage && <FormMessage />}
      </form>
    </StateCtx>
  );
}

export function FormMessage({ className }: { className?: string }) {
  const s = useFormState();
  if (!s.at) return null;
  if (!s.ok && s.error)
    return (
      <p role="alert" className={cn("mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger", className)}>
        <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {s.error}
      </p>
    );
  if (s.ok && s.message)
    return (
      <p role="status" className={cn("mt-3 flex items-start gap-2 rounded-xl border border-volt/30 bg-volt/5 px-3 py-2 text-sm text-volt", className)}>
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {s.message}
      </p>
    );
  return null;
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  full,
  className,
  pendingText,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} className={cn(buttonClass(variant, size, full), className)}>
      {pending ? (
        <>
          <Loader2 size={16} className="animate-spin" /> {pendingText ?? "Working…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Field-level error text, read from the enclosing ActionForm's state. */
export function FieldError({ name }: { name: string }) {
  const e = useFieldError(name);
  return e ? <p className="text-xs text-danger">{e}</p> : null;
}
