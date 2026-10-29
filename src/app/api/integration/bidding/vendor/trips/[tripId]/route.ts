import { validateBiddingIntegrationRequest } from "@/lib/integration/bidding/auth";
import { biddingCompanyIdQuerySchema } from "@/lib/integration/bidding/schemas";
import {
  getBiddingVendorTripDetail,
  resolveVendorIdByBiddingCompany,
} from "@/lib/services/bidding-integration.service";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { tripId: string } }) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const parsed = biddingCompanyIdQuerySchema.safeParse({
    biddingCompanyId: searchParams.get("biddingCompanyId"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const vendorId = await resolveVendorIdByBiddingCompany(parsed.data.biddingCompanyId);
  if (!vendorId) {
    return Response.json({ error: "Vendor not linked", code: "VENDOR_NOT_LINKED" }, { status: 404 });
  }

  const detail = await getBiddingVendorTripDetail(vendorId, params.tripId.trim());
  if (!detail) {
    return Response.json({ error: "Trip not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json(detail);
}
