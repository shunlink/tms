import { AppError } from "@/lib/api-errors";

export type IntegrationErrorCode =
  | "INTEGRATION_NOT_CONFIGURED"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR"
  | "EXPIRED"
  | "INVALID_RESPONSE";

export class IntegrationError extends AppError {
  readonly integrationCode: IntegrationErrorCode;
  readonly provider?: string;

  constructor(
    message: string,
    integrationCode: IntegrationErrorCode,
    opts: {
      status?: number;
      provider?: string;
      retryAfter?: number;
    } = {}
  ) {
    super(message, {
      status: opts.status ?? mapIntegrationStatus(integrationCode),
      code: "SERVER_ERROR",
      retryAfter: opts.retryAfter,
    });
    this.name = "IntegrationError";
    this.integrationCode = integrationCode;
    this.provider = opts.provider;
  }
}

function mapIntegrationStatus(code: IntegrationErrorCode): number {
  switch (code) {
    case "INVALID_INPUT":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "EXPIRED":
      return 422;
    case "INTEGRATION_NOT_CONFIGURED":
      return 503;
    case "PROVIDER_RATE_LIMITED":
      return 429;
    case "PROVIDER_TIMEOUT":
    case "PROVIDER_UNAVAILABLE":
    case "PROVIDER_ERROR":
    case "INVALID_RESPONSE":
    default:
      return 502;
  }
}

export function assertIntegrationConfigured(provider = "surepass") {
  const { isIntegrationConfigured } = require("./config") as typeof import("./config");
  if (!isIntegrationConfigured()) {
    throw new IntegrationError(
      "Verification provider is not configured. Add SUREPASS_API_KEY to the server environment.",
      "INTEGRATION_NOT_CONFIGURED",
      { status: 503, provider }
    );
  }
}
