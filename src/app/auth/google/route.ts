import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createGoogleAuthRequest, GOOGLE_STATE_COOKIE } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/session";

export async function GET(req: Request) {
  if (!config.google.enabled) return NextResponse.redirect(new URL("/login?error=google_not_configured", req.url));
  const baseUrl = new URL(req.url).origin;
  const next = safeNext(new URL(req.url).searchParams.get("next"), "/");
  const { url, state, verifier } = createGoogleAuthRequest(baseUrl);
  (await cookies()).set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, verifier, next, baseUrl }), {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
