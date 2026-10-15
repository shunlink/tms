import { validateBiddingIntegrationRequest } from "@/lib/integration/bidding/auth";
import { verifyCredentialsSchema } from "@/lib/integration/bidding/schemas";
import { verifyCredentialsForBidding } from "@/lib/services/bidding-verify-credentials.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => null);
    const parsed = verifyCredentialsSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const result = await verifyCredentialsForBidding(parsed.data);
    if (!result) {
      return Response.json({ error: "Unauthorized", code: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    return Response.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
