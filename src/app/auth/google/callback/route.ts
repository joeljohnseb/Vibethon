import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeGoogleCode, GOOGLE_STATE_COOKIE } from "@/lib/auth/google";
import { createSession, safeNext } from "@/lib/auth/session";
import { safeEqualStr } from "@/lib/codes";
import { loginWithGoogle } from "@/lib/services/users";
import { AppError } from "@/lib/errors";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const raw = jar.get(GOOGLE_STATE_COOKIE)?.value;
  jar.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
  const fail = (e: string) => NextResponse.redirect(new URL(`/login?error=${e}`, req.url));
  if (!raw) return fail("google_state");
  let saved: { state: string; verifier: string; next: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return fail("google_state");
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  if (!code || !safeEqualStr(state, saved.state)) return fail("google_state");
  try {
    const baseUrl = (saved as { baseUrl?: string }).baseUrl || url.origin;
    const profile = await exchangeGoogleCode(code, saved.verifier, baseUrl);
    const userId = await loginWithGoogle(profile);
    await createSession(userId);
    return NextResponse.redirect(new URL(safeNext(saved.next, "/"), req.url));
  } catch (e) {
    console.error("[eber:google]", e);
    return fail(e instanceof AppError && e.code === "FORBIDDEN" ? "suspended" : "google_failed");
  }
}
