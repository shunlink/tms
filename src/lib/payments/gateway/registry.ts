import "server-only";

import { gatewayExecutionEnabled, paymentProviderId } from "../config";
import type { PaymentGateway } from "./interface";
import { createDisabledPaymentGateway } from "./none";
import { createMockPaymentGateway } from "./mock";

let cached: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (cached) return cached;

  const id = paymentProviderId();
  if (id === "mock" && gatewayExecutionEnabled()) {
    cached = createMockPaymentGateway();
    return cached;
  }
  cached = createDisabledPaymentGateway();
  return cached;
}

/** For tests — override gateway instance */
export function setPaymentGatewayForTests(gateway: PaymentGateway | null) {
  cached = gateway;
}

export function resetPaymentGatewayCache() {
  cached = null;
}
