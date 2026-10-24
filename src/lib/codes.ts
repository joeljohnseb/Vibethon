import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Cryptographically secure numeric code, e.g. "042917". */
export function numericCode(digits = 6): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}

/** Keyed hash — a 6-digit code is brute-forceable with a plain hash, not without the server secret. */
export function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

export function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function randomBase32(len: number): string {
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += CROCKFORD[bytes[i] % 32];
  return s;
}

export const bookingReference = () => `EBR-${randomBase32(6)}`;
export const invoiceNumber = () => `INV-${new Date().getUTCFullYear()}-${randomBase32(8)}`;
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
