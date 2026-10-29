import { validateBiddingIntegrationRequest } from "@/lib/integration/bidding/auth";
import { biddingCompanyIdQuerySchema } from "@/lib/integration/bidding/schemas";
import {
  listBiddingClientPayments,
  resolveClientIdByBiddingCompany,
} from "@/lib/services/bidding-integration.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const parsed = biddingCompanyIdQuerySchema.safeParse({
    biddingCompanyId: searchParams.get("biddingCompanyId"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const clientId = await resolveClientIdByBiddingCompany(parsed.data.biddingCompanyId);
  if (!clientId) {
    return Response.json({ error: "Client not linked", code: "CLIENT_NOT_LINKED" }, { status: 404 });
  }

  const items = await listBiddingClientPayments(clientId);
  return Response.json({ items });
}
