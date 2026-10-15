import { requireAuth, authorize, notFound, ok } from "@/lib/api";
import { getClientReceivableSummary } from "@/lib/services/receivables.service";

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } }
) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "invoice.view");
  if (denied) return denied;

  const summary = await getClientReceivableSummary(params.clientId);
  if (!summary) return notFound("Client not found");

  return ok(summary);
}
