import { requireAuth, authorize, created, badRequest, serverError, notFound } from "@/lib/api";
import { partnerPortalCredentialsOnlySchema, validate } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { attachClientPortalUser } from "@/lib/services/partner-provisioning.service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "client.edit");
  if (denied) return denied;
  try {
    const client = await prisma.client.findUnique({ where: { id: params.id } });
    if (!client) return notFound("Client not found");

    const body = await req.json();
    const parsed = validate(partnerPortalCredentialsOnlySchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const result = await attachClientPortalUser(
      params.id,
      parsed.data,
      client.contactName ?? client.name
    );
    await logAudit({
      user: auth!.user,
      action: "employee.created",
      entity: "User",
      entityId: result.userId,
      meta: { role: "CLIENT", clientId: params.id },
    });
    return created(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create portal user";
    if (message.includes("already exists") || message.includes("portal user")) {
      return badRequest(message);
    }
    return serverError(e);
  }
}
