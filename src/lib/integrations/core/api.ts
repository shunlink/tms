import { badRequest, serviceUnavailable } from "@/lib/api";
import { IntegrationError } from "./errors";

export function handleIntegrationError(e: unknown) {
  if (e instanceof IntegrationError) {
    const status = e.status;
    if (e.integrationCode === "INTEGRATION_NOT_CONFIGURED") {
      return serviceUnavailable(e.message);
    }
    if (e.integrationCode === "NOT_FOUND") {
      return badRequest(e.message, { code: "NOT_FOUND" });
    }
    if (e.integrationCode === "INVALID_INPUT") {
      return badRequest(e.message, { code: "VALIDATION_ERROR" });
    }
    if (e.integrationCode === "PROVIDER_RATE_LIMITED") {
      return badRequest(e.message, { code: "RATE_LIMITED", retryAfter: e.retryAfter });
    }
    if (status === 422 || e.integrationCode === "EXPIRED") {
      return badRequest(e.message);
    }
    return badRequest(e.message);
  }
  return null;
}
