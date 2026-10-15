import { validateBiddingIntegrationRequest } from "@/lib/integration/bidding/auth";
import { BiddingIntegrationError } from "@/lib/integration/bidding/errors";
import { awardHandoffSchema } from "@/lib/integration/bidding/schemas";
import { createIndentFromBiddingAward } from "@/lib/services/bidding-integration.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = awardHandoffSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const result = await createIndentFromBiddingAward(parsed.data);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    if (e instanceof BiddingIntegrationError) {
      return Response.json(
        { error: e.message, code: e.code, ...(e.details ? { details: e.details } : {}) },
        { status: e.status }
      );
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
