import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, created, badRequest, serverError, safeOk } from "@/lib/api";
import { invoiceSchema, validate } from "@/lib/validation";
import { createInvoice } from "@/lib/services/invoice.service";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "invoice.view");
  if (denied) return denied;
  return safeOk(
    "invoices.list",
    () =>
      prisma.clientInvoice.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
    []
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "invoice.create");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(invoiceSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const { clientId, tripIds, gstRate, billing, lines } = parsed.data;
    const invoice = await createInvoice(
      {
        clientId,
        tripIds,
        gstRate,
        billing,
        lines: lines?.map((l) => ({
          ...l,
          amount: l.amount ?? undefined,
          gstRate: l.gstRate ?? undefined,
        })),
      },
      auth!.user
    );
    return created(invoice);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create invoice";
    if (message.includes("No valid trips") || message.includes("same client")) {
      return badRequest(message);
    }
    return serverError(e);
  }
}
