import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, created, badRequest, serverError, safeOk } from "@/lib/api";
import { clientSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.view");
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  if (searchParams.get("page")) {
    const { getClientsPaginated } = await import("@/lib/queries");
    return safeOk("clients.list", () =>
      getClientsPaginated({
        page: searchParams.get("page") ?? undefined,
        pageSize: searchParams.get("pageSize") ?? undefined,
      }),
      { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }
    );
  }
  return safeOk(
    "clients.list",
    () =>
      prisma.client.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { _count: { select: { trips: true, requirements: true, invoices: true } } },
      }),
    []
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(clientSchema, body);
    if (!parsed.success) return badRequest(parsed.error);
    const d = parsed.data;

    const client = await prisma.client.create({
      data: {
        name: d.name,
        legalName: d.legalName,
        contactName: d.contactName,
        phone: d.phone,
        altPhone: d.altPhone,
        email: d.email,
        accountsEmail: d.accountsEmail,
        gstin: d.gstin,
        pan: d.pan,
        cin: d.cin,
        msme: d.msme,
        industry: d.industry,
        website: d.website,
        notes: d.notes,
        ...(d.creditLimit != null || d.paymentTerms != null || d.securityDeposit != null
          ? { commercial: { create: { creditLimit: d.creditLimit, paymentTermsDays: d.paymentTerms, securityDeposit: d.securityDeposit } } }
          : {}),
      },
    });
    await logAudit({ user: auth!.user, action: "client.create", entity: "Client", entityId: client.id, meta: { name: client.name } });
    return created(client);
  } catch (e) {
    return serverError(e);
  }
}
