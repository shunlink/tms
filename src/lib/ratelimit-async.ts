import "server-only";

import { getRedis } from "./redis";

type Entry = { count: number; resetAt: number };

const memory = new Map<string, Entry>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number;
};

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memory.get(key);

  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { ok: true, remaining: limit - entry.count, retryAfter: 0 };
}

/** Async rate limit — uses Redis when available, otherwise in-memory. */
export async function rateLimitAsync(
  key: string,
  limit = 10,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const redis = await getRedis();
  if (!redis) return memoryRateLimit(key, limit, windowMs);

  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSec);
    }
    if (count > limit) {
      return { ok: false, remaining: 0, retryAfter: ttlSec };
    }
    return { ok: true, remaining: limit - count, retryAfter: 0 };
  } catch (e) {
    console.error("[ratelimit] Redis error — falling back to memory", e);
    return memoryRateLimit(key, limit, windowMs);
  }
}
