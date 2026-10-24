import "server-only";
import { createHash } from "node:crypto";
import { config } from "@/lib/config";
import { randomToken } from "@/lib/codes";

export const GOOGLE_STATE_COOKIE = "eber_g_state";
export const redirectUri = () => `${config.appUrl}/auth/google/callback`;

export function createGoogleAuthRequest() {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, verifier };
}

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string; picture?: string };

export async function exchangeGoogleCode(code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error("Google token exchange failed");
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new Error("Google profile request failed");
  const info = (await infoRes.json()) as { sub: string; email: string; email_verified: boolean; name?: string; picture?: string };
  return {
    sub: info.sub,
    email: info.email,
    emailVerified: Boolean(info.email_verified),
    name: info.name || info.email.split("@")[0],
    picture: info.picture,
  };
}
