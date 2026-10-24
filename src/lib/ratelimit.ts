/**
 * Small in-process sliding-window rate limiter. Good enough for a single
 * instance; swap for Redis/Upstash when running multiple instances.
 */
import { AppError } from "./errors";

const g = globalThis as unknown as { __eberRate?: Map<string, number[]> };
const buckets: Map<string, number[]> = (g.__eberRate ??= new Map<string, number[]>());

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t: number) => now - t < windowMs);
  if (hits.length >= limit) {
    const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
    throw new AppError("RATE_LIMITED", `Too many attempts. Please try again in ${retry}s.`);
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 50_000) buckets.clear();
}

export function resetRateLimits() {
  buckets.clear();
}
