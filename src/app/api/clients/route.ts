import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, created, badRequest, serverError, safeOk } from "@/lib/api";
import { clientSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { createClientProfile } from "@/lib/services/profile.service";

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

    const client = await createClientProfile(d);
    await logAudit({ user: auth!.user, action: "client.create", entity: "Client", entityId: client.id, meta: { name: client.name } });
    return created(client);
  } catch (e) {
    return serverError(e);
  }
}
