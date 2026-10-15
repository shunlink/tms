import { validateBiddingIntegrationRequest } from "@/lib/integration/bidding/auth";
import { vendorTripsQuerySchema } from "@/lib/integration/bidding/schemas";
import {
  listBiddingVendorTrips,
  resolveVendorIdByBiddingCompany,
} from "@/lib/services/bidding-integration.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const parsed = vendorTripsQuerySchema.safeParse({
    biddingCompanyId: searchParams.get("biddingCompanyId"),
    status: searchParams.get("status") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
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

  const items = await listBiddingVendorTrips(vendorId);
  const filtered =
    parsed.data.status ? items.filter((i) => i.displayStatus === parsed.data.status) : items;

  const limit = parsed.data.limit;
  const start = parsed.data.cursor ? filtered.findIndex((i) => i.tripId === parsed.data.cursor || i.indentId === parsed.data.cursor) + 1 : 0;
  const slice = filtered.slice(Math.max(0, start), Math.max(0, start) + limit);
  const nextCursor =
    start + limit < filtered.length
      ? (slice[slice.length - 1]?.tripId ?? slice[slice.length - 1]?.indentId ?? null)
      : null;

  return Response.json({ items: slice, nextCursor });
}
