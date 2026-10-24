import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { authIdentities, sessions, users } from "@/lib/db/schema";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { normalizePhone, sendOtp, verifyOtp } from "@/lib/auth/otp";
import { AppError, invalid, isUniqueViolation } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import type { GoogleProfile } from "@/lib/auth/google";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(200);
const nameSchema = z.string().trim().min(2, "Enter your name").max(80);

export async function registerWithEmail(input: { name: string; email: string; password: string }) {
  const name = nameSchema.safeParse(input.name);
  const email = emailSchema.safeParse(input.email);
  const pwProblem = passwordProblem(input.password ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!name.success) fieldErrors.name = name.error.issues[0].message;
  if (!email.success) fieldErrors.email = email.error.issues[0].message;
  if (pwProblem) fieldErrors.password = pwProblem;
  if (Object.keys(fieldErrors).length) throw invalid("Please fix the highlighted fields", fieldErrors);

  rateLimit(`register:${email.data}`, 5, 3600_000);
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ name: name.data!, email: email.data!, passwordHash })
        .returning({ id: users.id });
      await tx.insert(authIdentities).values({ userId: u.id, provider: "email", providerUserId: email.data! });
      return u.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw invalid("An account with this email already exists", { email: "Already registered — sign in instead" });
    throw e;
  }
}

export async function loginWithEmail(emailRaw: string, password: string, ip: string) {
  const email = emailSchema.safeParse(emailRaw);
  rateLimit(`login:ip:${ip}`, 20, 15 * 60_000);
  if (email.success) rateLimit(`login:email:${email.data}`, 8, 15 * 60_000);
  const [u] = email.success
    ? await db.select().from(users).where(sql`lower(${users.email}) = ${email.data}`).limit(1)
    : [];
  const ok = await verifyPassword(password ?? "", u?.passwordHash);
  if (!u || !ok) throw new AppError("VALIDATION", "Incorrect email or password");
  if (u.suspendedAt) throw new AppError("FORBIDDEN", "This account is suspended. Contact support.");
  return u.id;
}

/** Sign in or sign up with Google. Links to an existing account with the same verified email. */
export async function loginWithGoogle(p: GoogleProfile) {
  if (!p.emailVerified) throw new AppError("VALIDATION", "Your Google email address is not verified");
  return db.transaction(async (tx) => {
    const [ident] = await tx
      .select({ userId: authIdentities.userId })
      .from(authIdentities)
      .where(and(eq(authIdentities.provider, "google"), eq(authIdentities.providerUserId, p.sub)));
    let userId = ident?.userId;
    if (!userId) {
      const [existing] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${p.email.toLowerCase()}`);
      if (existing) userId = existing.id;
      else {
        const [u] = await tx
          .insert(users)
          .values({ name: p.name, email: p.email.toLowerCase(), emailVerifiedAt: new Date(), avatarUrl: p.picture })
          .returning({ id: users.id });
        userId = u.id;
      }
      await tx.insert(authIdentities).values({ userId, provider: "google", providerUserId: p.sub });
    }
    const [u] = await tx.select({ suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, userId));
    if (u?.suspendedAt) throw new AppError("FORBIDDEN", "This account is suspended. Contact support.");
    return userId;
  });
}

export async function requestPhoneLogin(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw ?? "");
  if (!phone) throw invalid("Enter a valid mobile number", { phone: "Enter a valid mobile number" });
  const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.phone, phone), sql`${users.phoneVerifiedAt} is not null`));
  if (!u) throw invalid("No account uses this number yet. Register with email or Google, then verify your phone.", { phone: "Not registered" });
  return { phone, ...(await sendOtp(phone, "login", u.id)) };
}

export async function confirmPhoneLogin(phoneRaw: string, code: string) {
  const phone = normalizePhone(phoneRaw ?? "");
  if (!phone) throw invalid("Enter a valid mobile number");
  await verifyOtp(phone, "login", code);
  const [u] = await db.select().from(users).where(eq(users.phone, phone));
  if (!u) throw invalid("Account not found");
  if (u.suspendedAt) throw new AppError("FORBIDDEN", "This account is suspended. Contact support.");
  return u.id;
}

export async function startPhoneVerification(userId: string, phoneRaw: string) {
  const phone = normalizePhone(phoneRaw ?? "");
  if (!phone) throw invalid("Enter a valid mobile number", { phone: "Enter a valid 10-digit mobile number" });
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phone, phone), ne(users.id, userId), sql`${users.phoneVerifiedAt} is not null`));
  if (taken) throw invalid("This number is already verified on another account", { phone: "Already in use" });
  return { phone, ...(await sendOtp(phone, "verify_phone", userId)) };
}

export async function confirmPhoneVerification(userId: string, phoneRaw: string, code: string) {
  const phone = normalizePhone(phoneRaw ?? "");
  if (!phone) throw invalid("Enter a valid mobile number");
  await verifyOtp(phone, "verify_phone", code);
  try {
    await db.transaction(async (tx) => {
      // Release the number from any account that entered it but never verified it.
      await tx
        .update(users)
        .set({ phone: null })
        .where(and(eq(users.phone, phone), ne(users.id, userId), sql`${users.phoneVerifiedAt} is null`));
      await tx.update(users).set({ phone, phoneVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
      await tx
        .insert(authIdentities)
        .values({ userId, provider: "phone", providerUserId: phone })
        .onConflictDoNothing();
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw invalid("This number is already verified on another account");
    throw e;
  }
}

export async function updateProfile(userId: string, input: { name: string }) {
  const name = nameSchema.safeParse(input.name);
  if (!name.success) throw invalid(name.error.issues[0].message, { name: name.error.issues[0].message });
  await db.update(users).set({ name: name.data, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function setActiveRole(userId: string, role: "taker" | "giver") {
  if (role !== "taker" && role !== "giver") throw invalid("Unknown role");
  await db.update(users).set({ activeRole: role }).where(eq(users.id, userId));
}

export async function changePassword(userId: string, current: string, next: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw invalid("Account not found");
  if (u.passwordHash && !(await verifyPassword(current ?? "", u.passwordHash)))
    throw invalid("Current password is incorrect", { current: "Incorrect password" });
  const problem = passwordProblem(next ?? "");
  if (problem) throw invalid(problem, { password: problem });
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(next), updatedAt: new Date() }).where(eq(users.id, userId));
    if (u.email)
      await tx
        .insert(authIdentities)
        .values({ userId, provider: "email", providerUserId: u.email.toLowerCase() })
        .onConflictDoNothing();
  });
}

export async function signOutEverywhere(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
