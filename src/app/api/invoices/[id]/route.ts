import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { updateInvoice, finalizeInvoice } from "@/lib/services/invoice.service";
import { rejectDirectInvoicePaymentFields } from "@/lib/invoice-payment";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "invoice.view");
  if (denied) return denied;
  try {
    const invoice = await prisma.clientInvoice.findFirst({
      where: { id: params.id },
      include: {
        client: true,
        createdBy: { select: { id: true, name: true, email: true } },
        lines: { include: { trip: true } },
      },
    });
    if (!invoice) return notFound("Invoice not found");
    return ok(invoice);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "invoice.edit");
  if (denied) return denied;
  try {
    const body = await req.json();

    if (body.action === "finalize") {
      const invoice = await finalizeInvoice(params.id, auth!.user);
      return ok(invoice);
    }

    const paymentReject = rejectDirectInvoicePaymentFields(body);
    if (paymentReject) return badRequest(paymentReject);

    const invoice = await updateInvoice(
      params.id,
      {
        status: body.status,
        billing: body.billing,
        lines: body.lines,
      },
      auth!.user
    );
    if (!invoice) return notFound("Invoice not found");
    return ok(invoice);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invoice update failed";
    if (msg.includes("not found") || msg.includes("Only draft") || msg.includes("already finalized")) {
      return notFound(msg);
    }
    if (msg.includes("Record Payment")) return badRequest(msg);
    return serverError(e);
  }
}
