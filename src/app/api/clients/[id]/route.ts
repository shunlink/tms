import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { clientSchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { updateClientProfile } from "@/lib/services/profile.service";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.view");
  if (denied) return denied;
  try {
    const client = await prisma.client.findFirst({
      where: { id: params.id },
      include: { trips: true, requirements: true, invoices: true, commercial: true },
    });
    if (!client) return notFound("Client not found");
    return ok(client);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.edit");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(clientSchema.partial(), body);
    if (!parsed.success) return badRequest(parsed.error);

    const client = await updateClientProfile(params.id, parsed.data);
    if (!client) return notFound("Client not found");
    if (body.isActive != null) {
      await prisma.client.update({ where: { id: params.id }, data: { isActive: body.isActive } });
    }
    await logAudit({ user: auth!.user, action: "client.update", entity: "Client", entityId: client.id });
    return ok(client);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.edit");
  if (denied) return denied;
  try {
    const existing = await prisma.client.findFirst({ where: { id: params.id } });
    if (!existing) return notFound("Client not found");
    await prisma.client.update({ where: { id: params.id }, data: { isActive: false, deletedAt: new Date() } });
    await logAudit({ user: auth!.user, action: "client.deactivate", entity: "Client", entityId: params.id, meta: { name: existing.name } });
    return ok({ success: true });
  } catch {
    return badRequest("Cannot deactivate client with linked records");
  }
}
