import "server-only";

import { getRedis } from "./redis";

type Entry = { value: string; expiresAt: number };

const memory = new Map<string, Entry>();

function memGet(key: string): string | null {
  const e = memory.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    memory.delete(key);
    return null;
  }
  return e.value;
}

function memSet(key: string, value: string, ttlSeconds: number) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** TTL cache — Redis when REDIS_URL is set, otherwise in-process. */
export async function cacheGet(key: string): Promise<string | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      return await redis.get(key);
    } catch (e) {
      console.error("[cache] Redis get failed — using memory", e);
    }
  }
  return memGet(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds = 60) {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(key, value, "EX", Math.max(1, ttlSeconds));
      return;
    } catch (e) {
      console.error("[cache] Redis set failed — using memory", e);
    }
  }
  memSet(key, value, ttlSeconds);
}

export async function cacheDel(key: string) {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch (e) {
      console.error("[cache] Redis del failed — using memory", e);
    }
  }
  memory.delete(key);
}

/** Run fn once per key within TTL; uses JSON serialization. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = await cacheGet(key);
  if (hit) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      /* stale */
    }
  }
  const value = await fn();
  await cacheSet(key, JSON.stringify(value), ttlSeconds);
  return value;
}
