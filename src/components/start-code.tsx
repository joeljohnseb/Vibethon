"use client";

import { useEffect, useState } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import { ActionForm, SubmitButton } from "./action-form";
import { issueCodeAction } from "@/app/actions/bookings";
import type { ActionState } from "@/lib/action";

function useCountdown(to: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!to) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [to]);
  if (!to) return null;
  return Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
}

/** Driver-side panel: generate and display the single-use start code. */
export function StartCodePanel({ bookingId }: { bookingId: string }) {
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const left = useCountdown(code?.expiresAt ?? null);
  const expired = left === 0;

  return (
    <div className="rounded-2xl border border-volt/30 bg-gradient-to-b from-volt/10 to-transparent p-5 text-center">
      {code && !expired ? (
        <>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Your start code</div>
          <div className="mt-3 font-mono text-5xl font-bold tracking-[0.25em] text-volt sm:text-6xl" aria-live="polite">
            {code.code.slice(0, 3)}&nbsp;{code.code.slice(3)}
          </div>
          <div className="mt-3 text-sm text-muted">
            Show this to your host. Expires in{" "}
            <span className="font-mono text-ink">
              {Math.floor((left ?? 0) / 60)}:{String((left ?? 0) % 60).padStart(2, "0")}
            </span>
          </div>
          <p className="mt-1 text-xs text-faint">Single-use and valid only for this booking. Never share it before you arrive.</p>
        </>
      ) : (
        <>
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-volt/15 text-volt">
            <KeyRound />
          </div>
          <div className="mt-3 font-display text-lg font-semibold">{expired ? "Your code expired" : "Arrived at the charger?"}</div>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Generate your one-time code and show it to the host. They&apos;ll enter it to start your session.</p>
        </>
      )}
      <ActionForm action={issueCodeAction} className="mt-4" onSuccess={(s: ActionState) => setCode(s.data as { code: string; expiresAt: string })}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <SubmitButton variant={code && !expired ? "secondary" : "primary"} size={code && !expired ? "sm" : "lg"} pendingText="Generating…">
          {code && !expired ? (
            <>
              <RefreshCw size={14} /> New code
            </>
          ) : (
            "Show my start code"
          )}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
