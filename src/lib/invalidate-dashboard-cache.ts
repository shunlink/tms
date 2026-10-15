import { bumpDataVersion, dataVersion } from "./data-version";

export const DASHBOARD_CACHE_KEY = "dashboard:kpis";

export function dashboardCacheKey() {
  return `${DASHBOARD_CACHE_KEY}:v${dataVersion()}`;
}

/** Writes through Prisma already bump the data version; kept for explicit callers. */
export async function invalidateDashboardCache() {
  bumpDataVersion();
}
