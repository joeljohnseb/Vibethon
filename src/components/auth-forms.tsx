"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, Smartphone } from "lucide-react";
import { ActionForm, FieldError, SubmitButton, useFormState } from "./action-form";
import { inputClass, Notice } from "./ui";
import { cn } from "@/lib/utils";
import { loginAction, phoneLoginConfirmAction, phoneLoginRequestAction, registerAction } from "@/app/actions/auth";
import type { ActionState } from "@/lib/action";

export function GoogleButton({ enabled, next }: { enabled: boolean; next?: string }) {
  const href = `/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const body = (
    <>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continue with Google
    </>
  );
  const cls = "flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-surface-2 text-[15px] font-semibold hover:bg-surface-3";
  if (!enabled)
    return (
      <div>
        <button disabled className={cn(cls, "cursor-not-allowed opacity-50")}>{body}</button>
        <p className="mt-1.5 text-center text-xs text-faint">Google sign-in needs GOOGLE_CLIENT_ID / SECRET (see README).</p>
      </div>
    );
  return (
    <a href={href} className={cls}>
      {body}
    </a>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-faint">
      <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
    </div>
  );
}

function TextField({ name, label, type = "text", autoComplete, placeholder, defaultValue, inputMode }: { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string; defaultValue?: string; inputMode?: "numeric" | "tel" | "email" }) {
  const s = useFormState();
  const err = s.fieldErrors?.[name];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">{label}</label>
      <input id={name} name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} defaultValue={defaultValue} inputMode={inputMode} aria-invalid={err ? true : undefined} className={inputClass} />
      <FieldError name={name} />
    </div>
  );
}

export function LoginForms({ next, googleEnabled, smsSandbox }: { next?: string; googleEnabled: boolean; smsSandbox: boolean }) {
  const [tab, setTab] = useState<"email" | "phone">("email");
  return (
    <div>
      <GoogleButton enabled={googleEnabled} next={next} />
      <Divider />
      <div className="mb-4 grid grid-cols-2 rounded-xl border border-line bg-surface-2 p-1 text-sm">
        {(["email", "phone"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("flex items-center justify-center gap-2 rounded-lg py-2 font-medium", tab === t ? "bg-surface-3 text-ink" : "text-muted")}>
            {t === "email" ? <Mail size={15} /> : <Smartphone size={15} />} {t === "email" ? "Email" : "Phone OTP"}
          </button>
        ))}
      </div>
      {tab === "email" ? (
        <ActionForm action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" />
          <TextField name="password" label="Password" type="password" autoComplete="current-password" />
          <SubmitButton full pendingText="Signing in…">Sign in</SubmitButton>
        </ActionForm>
      ) : (
        <PhoneLogin next={next} smsSandbox={smsSandbox} />
      )}
    </div>
  );
}

function PhoneLogin({ next, smsSandbox }: { next?: string; smsSandbox: boolean }) {
  const [sent, setSent] = useState<{ phone: string; sandboxCode: string | null } | null>(null);
  if (!sent)
    return (
      <ActionForm action={phoneLoginRequestAction} className="space-y-4" onSuccess={(s: ActionState) => setSent(s.data as { phone: string; sandboxCode: string | null })} showMessage>
        <TextField name="phone" label="Mobile number" type="tel" autoComplete="tel" inputMode="tel" placeholder="98765 43210" />
        <p className="text-xs text-faint">For accounts that have already verified a phone number.{smsSandbox && " Test mode: the code is shown on screen instead of sent by SMS."}</p>
        <SubmitButton full pendingText="Sending…">Send code</SubmitButton>
      </ActionForm>
    );
  return (
    <ActionForm action={phoneLoginConfirmAction} className="space-y-4">
      <input type="hidden" name="phone" value={sent.phone} />
      <input type="hidden" name="next" value={next ?? ""} />
      {sent.sandboxCode && (
        <Notice tone="warn" title="Test mode SMS">
          Your code is <span className="font-mono font-bold tracking-widest">{sent.sandboxCode}</span>
        </Notice>
      )}
      <p className="text-sm text-muted">Enter the 6-digit code sent to {sent.phone}.</p>
      <TextField name="code" label="Verification code" inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" />
      <SubmitButton full pendingText="Verifying…">Verify & sign in</SubmitButton>
      <button type="button" onClick={() => setSent(null)} className="w-full text-center text-sm text-muted hover:text-ink">
        Use a different number
      </button>
    </ActionForm>
  );
}

export function RegisterForm({ next, role, googleEnabled }: { next?: string; role: "taker" | "giver"; googleEnabled: boolean }) {
  const [r, setR] = useState(role);
  return (
    <div>
      <GoogleButton enabled={googleEnabled} next={next ?? (r === "giver" ? "/host" : undefined)} />
      <Divider />
      <ActionForm action={registerAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <div className="mb-1.5 text-sm font-medium">I mainly want to…</div>
          <div className="grid grid-cols-2 gap-2">
            {([["taker", "Charge my EV"], ["giver", "Share my charger"]] as const).map(([v, label]) => (
              <label key={v} className={cn("cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition", r === v ? "border-volt bg-volt/10 text-volt" : "border-line bg-surface-2 text-muted")}>
                <input type="radio" name="role" value={v} checked={r === v} onChange={() => setR(v)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-faint">You can switch between driver and host anytime — it&apos;s one account.</p>
        </div>
        <TextField name="name" label="Full name" autoComplete="name" />
        <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" />
        <TextField name="password" label="Password" type="password" autoComplete="new-password" placeholder="8+ characters, letters and numbers" />
        <label className="flex items-start gap-2.5 text-sm text-muted">
          <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-[#2ee88a]" />
          <span>
            I agree to the <Link href="/legal/terms" className="text-volt hover:underline">Terms</Link>, <Link href="/legal/privacy" className="text-volt hover:underline">Privacy Policy</Link> and <Link href="/safety" className="text-volt hover:underline">Safety guidelines</Link>.
          </span>
        </label>
        <FieldError name="terms" />
        <SubmitButton full pendingText="Creating account…">Create account</SubmitButton>
      </ActionForm>
    </div>
  );
}
