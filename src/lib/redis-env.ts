/** True when REDIS_URL is set in the environment. */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

/**
 * Redis is optional at build time. `next build` pre-renders pages; probing Redis
 * then only spams ECONNREFUSED when Docker is not publishing 6379 to the host.
 */
export function useRedisAtRuntime(): boolean {
  if (!isRedisConfigured()) return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}
