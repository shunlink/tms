import { validateBiddingIntegrationRequest } from "@/lib/integration/bidding/auth";
import { biddingCompanyIdQuerySchema } from "@/lib/integration/bidding/schemas";
import {
  getBiddingClientInvoicePdfBytes,
  resolveClientIdByBiddingCompany,
} from "@/lib/services/bidding-integration.service";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { invoiceId: string } },
) {
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

  try {
    const result = await getBiddingClientInvoicePdfBytes(clientId, params.invoiceId);
    if (!result) {
      return Response.json({ error: "Invoice not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const safeName = result.invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new Response(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF generation failed";
    if (msg.includes("CHROME_PATH") || msg.includes("Chrome or Edge")) {
      return Response.json({ error: msg, code: "PDF_UNAVAILABLE" }, { status: 503 });
    }
    return Response.json({ error: msg, code: "PDF_FAILED" }, { status: 500 });
  }
}
