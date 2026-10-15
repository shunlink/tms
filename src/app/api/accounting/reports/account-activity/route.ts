import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import { listPostedAccountActivity } from "@/lib/accounting/gl-balances.service";
import { parseIsoDate } from "@/lib/accounting/report-query";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.report.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const accountCode = url.searchParams.get("accountCode");
    if (!accountCode) return badRequest("accountCode is required");
    const fromDate = parseIsoDate(url.searchParams.get("fromDate"), "fromDate") ?? undefined;
    const toDate = parseIsoDate(url.searchParams.get("toDate"), "toDate") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const clientId = url.searchParams.get("clientId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const result = await listPostedAccountActivity({
      accountCode,
      fromDate,
      toDate,
      vendorId,
      clientId,
      limit,
      offset,
    });
    return ok(result);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid")) return badRequest(e.message);
    return serverError(e);
  }
}
