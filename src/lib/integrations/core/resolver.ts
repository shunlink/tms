import "server-only";

import { integrationMode, isIntegrationLive } from "./config";
import { IntegrationError } from "./errors";

export function assertLiveIntegrationConfigured(): void {
  if (integrationMode() === "live" && !isIntegrationLive()) {
    throw new IntegrationError(
      "Verification provider is not configured. Set SUREPASS_API_KEY or use INTEGRATION_MODE=mock.",
      "INTEGRATION_NOT_CONFIGURED",
      { provider: "surepass" }
    );
  }
}

/** Run live provider when configured; otherwise return mock data without blocking workflows. */
export async function withIntegrationProvider<T>(
  mockFn: () => Promise<T>,
  liveFn: () => Promise<T>
): Promise<T> {
  if (isIntegrationLive()) return liveFn();
  if (integrationMode() === "live") assertLiveIntegrationConfigured();
  return mockFn();
}
