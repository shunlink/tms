import { ok, unauthorized, requireAuth } from "@/lib/api";
import { gatewayExecutionEnabled, paymentProviderId } from "@/lib/payments/config";
import { hypercheckoutEnabled } from "@/lib/payments/inbound/hypercheckout.service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  return ok({
    providerId: paymentProviderId(),
    executionEnabled: gatewayExecutionEnabled(),
    hypercheckoutEnabled: hypercheckoutEnabled(),
  });
}
