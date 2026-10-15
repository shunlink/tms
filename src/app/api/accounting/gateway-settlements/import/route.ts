import { requireAuth, authorize, ok, badRequest, serverError, unauthorized } from "@/lib/api";
import {
  GatewaySettlementImportError,
  importGatewaySettlementCsv,
} from "@/lib/accounting/reconciliation/gateway-settlement-import.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.reconcile.gateway.import");
  if (denied) return denied;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("file is required");
    const csvText = await file.text();
    const batchReference = form.get("batchReference") ? String(form.get("batchReference")) : undefined;
    const result = await importGatewaySettlementCsv({
      csvText,
      fileName: file.name,
      batchReference,
      actorId: auth.user.id,
    });
    return ok(result);
  } catch (e) {
    if (e instanceof GatewaySettlementImportError) return badRequest(e.message);
    return serverError(e);
  }
}
