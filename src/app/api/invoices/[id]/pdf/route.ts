import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, unauthorized, notFound, serverError } from "@/lib/api";
import { hasPermission } from "@/lib/services/permission.service";
import { generateInvoicePdfBytes } from "@/lib/services/invoice-document.service";
import { isInternalRole } from "@/lib/teams";

export const runtime = "nodejs";

async function canViewInvoice(
  auth: NonNullable<Awaited<ReturnType<typeof requireAuth>>>,
  invoiceId: string
): Promise<boolean> {
  const invoice = await prisma.clientInvoice.findFirst({
    where: { id: invoiceId },
    select: { clientId: true },
  });
  if (!invoice) return false;

  if (auth.user.role === "CLIENT" && auth.user.clientId === invoice.clientId) {
    return true;
  }

  if (!isInternalRole(auth.user.role)) return false;
  if (auth.actor.role === "SUPER_ADMIN") return true;
  return await hasPermission(auth.user.id, "invoice.view");
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  try {
    const allowed = await canViewInvoice(auth, params.id);
    if (!allowed) return notFound("Invoice not found");

    const invoice = await prisma.clientInvoice.findFirst({
      where: { id: params.id },
      select: { invoiceNumber: true },
    });
    if (!invoice) return notFound("Invoice not found");

    const pdf = await generateInvoicePdfBytes(params.id);
    const safeName = invoice.invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF generation failed";
    if (msg.includes("CHROME_PATH") || msg.includes("Chrome or Edge")) {
      return NextResponse.json({ success: false, error: msg }, { status: 503 });
    }
    return serverError(e);
  }
}
