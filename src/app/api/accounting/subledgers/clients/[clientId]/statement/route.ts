import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { buildClientStatement } from "@/lib/accounting/client-subledger.service";
import { parseIsoDate } from "@/lib/accounting/report-query";
import { subledgerLinesToCsv } from "@/lib/accounting/report-export";

export const runtime = "nodejs";

type Params = { params: { clientId: string } };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.subledger.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const fromDate = parseIsoDate(url.searchParams.get("fromDate"), "fromDate") ?? undefined;
    const toDate = parseIsoDate(url.searchParams.get("toDate"), "toDate") ?? undefined;
    const statement = await buildClientStatement({
      clientId: params.clientId,
      fromDate,
      toDate,
      invoiceId: url.searchParams.get("invoiceId") ?? undefined,
      indentId: url.searchParams.get("indentId") ?? undefined,
      tripId: url.searchParams.get("tripId") ?? undefined,
      documentType: (url.searchParams.get("documentType") as never) ?? undefined,
      reference: url.searchParams.get("reference") ?? undefined,
      currency: url.searchParams.get("currency") ?? undefined,
    });
    if (!statement) return notFound("Client not found");

    if (url.searchParams.get("format") === "csv") {
      const exportDenied = await authorize(auth, "accounting.report.export");
      if (exportDenied) return exportDenied;
      const csv = subledgerLinesToCsv(statement.lines);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="client-statement-${params.clientId}.csv"`,
        },
      });
    }

    return ok(statement);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid")) return badRequest(e.message);
    return serverError(e);
  }
}
