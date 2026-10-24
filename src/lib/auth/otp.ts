import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { otpCodes } from "@/lib/db/schema";
import { config } from "@/lib/config";
import { hmac, numericCode, safeEqualHex } from "@/lib/codes";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";

const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;

/** Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX). */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  let m = /^(?:\+91|0091|91|0)?([6-9]\d{9})$/.exec(digits);
  if (m) return `+91${m[1]}`;
  m = /^\+([1-9]\d{7,14})$/.exec(digits);
  return m ? `+${m[1]}` : null;
}

async function deliverSms(phone: string, body: string) {
  const { twilioSid, twilioToken, twilioFrom } = config.sms;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: phone, From: twilioFrom, Body: body }),
  });
  if (!res.ok) throw new AppError("CONFIG", "We couldn't send the SMS right now. Please try again shortly.");
}

export type SendOtpResult = { sentTo: string; sandboxCode?: string };

/**
 * Generates and sends a one-time code. In sandbox mode (no SMS provider
 * configured, never in production unless EBER_ALLOW_SANDBOX=true) the code is
 * returned so the UI can show it in a clearly labelled test banner.
 */
export async function sendOtp(phone: string, purpose: "verify_phone" | "login", userId?: string): Promise<SendOtpResult> {
  const mode = config.sms.mode;
  if (mode === "disabled") throw new AppError("CONFIG", "Phone verification is not configured");
  rateLimit(`otp:send:30s:${phone}`, 1, 30_000);
  rateLimit(`otp:send:1h:${phone}`, 5, 3600_000);

  const code = numericCode(6);
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, purpose), isNull(otpCodes.consumedAt)));
  await db.insert(otpCodes).values({
    phone,
    purpose,
    userId,
    codeHash: hmac(config.secret, `otp:${phone}:${purpose}:${code}`),
    expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
  });

  if (mode === "twilio") {
    await deliverSms(phone, `${code} is your Eber verification code. It expires in ${OTP_TTL_MIN} minutes. Never share it.`);
    return { sentTo: phone };
  }
  console.info(`[eber:sandbox-sms] OTP for ${phone} (${purpose}): ${code}`);
  return { sentTo: phone, sandboxCode: code };
}

/** Verifies and consumes a code. Throws on failure. */
export async function verifyOtp(phone: string, purpose: "verify_phone" | "login", code: string) {
  rateLimit(`otp:verify:${phone}`, 10, 15 * 60_000);
  if (!/^\d{6}$/.test(code)) throw new AppError("VALIDATION", "Enter the 6-digit code");
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.purpose, purpose),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!row) throw new AppError("VALIDATION", "This code has expired. Request a new one.");
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
    throw new AppError("RATE_LIMITED", "Too many incorrect attempts. Request a new code.");
  }
  const ok = safeEqualHex(row.codeHash, hmac(config.secret, `otp:${phone}:${purpose}:${code}`));
  if (!ok) {
    await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
    throw new AppError("VALIDATION", "Incorrect code");
  }
  // Single use: only the first concurrent verifier wins.
  const consumed = await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id });
  if (!consumed.length) throw new AppError("VALIDATION", "This code has already been used");
}
