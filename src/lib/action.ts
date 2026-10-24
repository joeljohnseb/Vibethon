import "server-only";
import { unstable_rethrow } from "next/navigation";
import { refresh } from "next/cache";
import { AppError } from "./errors";
import { UploadError } from "./storage";

export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
  /** Incremented on each submit so client effects can react to repeat results. */
  at?: number;
};

export const initialState: ActionState = { ok: false };

/**
 * Run a server-action body, turning domain errors into form state. Redirects
 * and other Next.js control-flow errors are re-thrown untouched.
 */
export async function act(fn: () => Promise<void | Partial<ActionState> | string>): Promise<ActionState> {
  try {
    const r = await fn();
    try {
      refresh();
    } catch {
      /* not in an action context (tests) */
    }
    if (typeof r === "string") return { ok: true, message: r, at: Date.now() };
    return { ok: true, ...(r ?? {}), at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AppError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors, at: Date.now() };
    if (e instanceof UploadError) return { ok: false, error: e.message, at: Date.now() };
    console.error("[eber:action]", e);
    return { ok: false, error: "Something went wrong. Please try again.", at: Date.now() };
  }
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
