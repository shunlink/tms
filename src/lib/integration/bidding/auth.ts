import { NextResponse } from "next/server";

export function getBiddingIntegrationSecret(): string | null {
  const secret = process.env.BIDDING_TMS_INTEGRATION_SECRET?.trim();
  return secret || null;
}

export function validateBiddingIntegrationRequest(req: Request): NextResponse | null {
  const expected = getBiddingIntegrationSecret();
  if (!expected) {
    return NextResponse.json(
      { error: "Bidding integration is not configured", code: "INTEGRATION_DISABLED" },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-tms-integration-secret");

  let provided: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    provided = authHeader.slice("Bearer ".length).trim();
  } else if (headerSecret) {
    provided = headerSecret.trim();
  }

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized", code: "INVALID_INTEGRATION_SECRET" }, { status: 401 });
  }

  return null;
}
