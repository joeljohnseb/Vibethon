import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;
const N = 16384, r = 8, p = 1, KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Spend comparable time so missing accounts aren't distinguishable by timing.
    await hashPassword(password);
    return false;
  }
  const [alg, n, rr, pp, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(rr), p: Number(pp), maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(key, expected);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters";
  if (pw.length > 200) return "Password is too long";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Include at least one letter and one number";
  return null;
}
