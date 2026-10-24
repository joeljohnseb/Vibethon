import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { config } from "@/lib/config";
import { randomToken } from "@/lib/codes";
import { AppError } from "@/lib/errors";

export const SESSION_COOKIE = "eber_session";
const SESSION_DAYS = 30;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt, userAgent: ua });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = Pick<
  User,
  "id" | "name" | "email" | "phone" | "phoneVerifiedAt" | "activeRole" | "isAdmin" | "avatarUrl" | "suspendedAt" | "passwordHash"
>;

/** The signed-in user for this request (memoised per request), or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      phoneVerifiedAt: users.phoneVerifiedAt,
      activeRole: users.activeRole,
      isAdmin: users.isAdmin,
      avatarUrl: users.avatarUrl,
      suspendedAt: users.suspendedAt,
      passwordHash: users.passwordHash,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
});

/** For pages: redirect to login when signed out. */
export async function requireUserPage(next?: string): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (u.suspendedAt) redirect("/suspended");
  return u;
}

/** For server actions / route handlers: throw when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new AppError("UNAUTHENTICATED", "Please sign in to continue");
  if (u.suspendedAt) throw new AppError("FORBIDDEN", "Your account is suspended");
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.isAdmin) throw new AppError("FORBIDDEN", "Administrator access required");
  return u;
}

export async function requireAdminPage(): Promise<CurrentUser> {
  const u = await requireUserPage("/admin");
  if (!u.isAdmin) redirect("/");
  return u;
}

/** Only allow same-site relative redirect targets. */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
