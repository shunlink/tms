import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { buildVendorStatement } from "@/lib/accounting/vendor-subledger.service";
import { parseIsoDate } from "@/lib/accounting/report-query";
import { subledgerLinesToCsv } from "@/lib/accounting/report-export";

export const runtime = "nodejs";

type Params = { params: { vendorId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.subledger.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const fromDate = parseIsoDate(url.searchParams.get("fromDate"), "fromDate") ?? undefined;
    const toDate = parseIsoDate(url.searchParams.get("toDate"), "toDate") ?? undefined;
    const viewParam = url.searchParams.get("view");
    const view = viewParam === "all" ? "all" : "operational";
    const statement = await buildVendorStatement({
      vendorId: params.vendorId,
      fromDate,
      toDate,
      indentId: url.searchParams.get("indentId") ?? undefined,
      tripId: url.searchParams.get("tripId") ?? undefined,
      documentType: (url.searchParams.get("documentType") as never) ?? undefined,
      paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
      reference: url.searchParams.get("reference") ?? undefined,
      currency: url.searchParams.get("currency") ?? undefined,
      view,
    });
    if (!statement) return notFound("Vendor not found");

    if (url.searchParams.get("format") === "csv") {
      const exportDenied = await authorize(auth, "accounting.report.export");
      if (exportDenied) return exportDenied;
      const csv = subledgerLinesToCsv(statement.lines);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="vendor-statement-${params.vendorId}.csv"`,
        },
      });
    }

    return ok(statement);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid")) return badRequest(e.message);
    return serverError(e);
  }
}
