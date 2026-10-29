import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { updateInvoice, finalizeInvoice } from "@/lib/services/invoice.service";
import { rejectDirectInvoicePaymentFields } from "@/lib/invoice-payment";

const invoiceBillingPatchSchema = z.object({
  billingName: z.string().nullable().optional(),
  billingGstin: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  billingEmail: z.string().nullable().optional(),
  paymentTermsDays: z.coerce.number().int().nullable().optional(),
});

const invoicePatchSchema = z.object({
  action: z.literal("finalize").optional(),
  status: z.enum(["DRAFT", "SENT", "PAID", "PARTIALLY_PAID", "OVERDUE", "CANCELLED"]).optional(),
  billing: invoiceBillingPatchSchema.optional(),
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        amount: z.coerce.number().optional(),
        gstRate: z.coerce.number().optional(),
        description: z.string().nullable().optional(),
      })
    )
    .optional(),
});

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
    const rawBody = await req.json();
    const parsed = invoicePatchSchema.safeParse(rawBody);
    if (!parsed.success) return badRequest(parsed.error.message);

    if (parsed.data.action === "finalize") {
      const invoice = await finalizeInvoice(params.id, auth!.user);
      return ok(invoice);
    }

    const paymentReject = rejectDirectInvoicePaymentFields(rawBody);
    if (paymentReject) return badRequest(paymentReject);

    const existing = await prisma.clientInvoice.findFirst({
      where: { id: params.id },
      select: { status: true },
    });
    if (!existing) return notFound("Invoice not found");

    const hasDraftOnlyEdits =
      parsed.data.billing !== undefined || (parsed.data.lines !== undefined && parsed.data.lines.length > 0);
    if (hasDraftOnlyEdits && existing.status !== "DRAFT") {
      return badRequest("Only draft invoices can be edited");
    }

    const invoice = await updateInvoice(
      params.id,
      {
        status: parsed.data.status,
        billing: parsed.data.billing,
        lines: parsed.data.lines,
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
