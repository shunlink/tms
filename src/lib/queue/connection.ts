import "server-only";
import { useRedisAtRuntime } from "../redis-env";

let bullConnection: { host: string; port: number; password?: string } | null = null;

export function queueEnabled(): boolean {
  return useRedisAtRuntime();
}

export function getBullConnection() {
  if (!queueEnabled()) return null;
  if (bullConnection) return bullConnection;

  const url = new URL(process.env.REDIS_URL!.trim());
  const isLocal =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  bullConnection = {
    host: isLocal ? "127.0.0.1" : url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
  };
  return bullConnection;
}
