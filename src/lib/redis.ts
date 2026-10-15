import "server-only";
import { useRedisAtRuntime } from "./redis-env";

/**
 * Optional Redis client. When REDIS_URL is unset or Redis is unreachable,
 * callers fall back to in-memory stores.
 */

type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  ping(): Promise<string>;
  quit(): Promise<string>;
  disconnect(): void;
};

let initPromise: Promise<RedisClient | null> | null = null;

export function redisEnabled(): boolean {
  return useRedisAtRuntime();
}

async function destroyRedis(instance: RedisClient) {
  try {
    await instance.quit();
  } catch {
    instance.disconnect();
  }
}

async function connectRedis(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL!.trim();
  let instance: RedisClient | null = null;

  try {
    const { default: Redis } = await import("ioredis");
    const parsed = new URL(url);
    const port = Number(parsed.port || 6379);
    const isLocal =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";

    const redis = isLocal
      ? new Redis({
          host: "127.0.0.1",
          port,
          family: 4,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          lazyConnect: true,
          connectTimeout: 2_000,
          retryStrategy: () => null,
        })
      : new Redis(url, {
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          lazyConnect: true,
          connectTimeout: 2_000,
          retryStrategy: () => null,
        });

    // Prevent noisy "Unhandled error event" logs while probing the connection.
    redis.on("error", () => {});

    await redis.connect();
    await redis.ping();
    instance = redis as RedisClient;
    return instance;
  } catch {
    if (instance) await destroyRedis(instance);
    console.warn(
      "[redis] Unavailable at %s — using in-memory fallback (run `docker compose up -d redis` or remove REDIS_URL)",
      url
    );
    return null;
  }
}

export async function getRedis(): Promise<RedisClient | null> {
  if (!redisEnabled()) return null;
  if (!initPromise) initPromise = connectRedis();
  return initPromise;
}
