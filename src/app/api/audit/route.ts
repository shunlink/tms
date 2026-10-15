import { requireAuth, authorize, ok, badRequest, serverError } from "@/lib/api";
import { getAuditLogs } from "@/lib/queries";

/** Read-only audit log API — append-only records, no mutation endpoints. */
export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "audit.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? undefined;
    const teamCode = url.searchParams.get("teamCode") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const entity = url.searchParams.get("entity") ?? undefined;
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const tripId = url.searchParams.get("tripId") ?? undefined;
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    const limitStr = url.searchParams.get("limit");

    let from: Date | undefined;
    let to: Date | undefined;
    if (fromStr) {
      from = new Date(fromStr);
      if (Number.isNaN(from.getTime())) return badRequest("Invalid from date");
    }
    if (toStr) {
      to = new Date(toStr);
      if (Number.isNaN(to.getTime())) return badRequest("Invalid to date");
    }

    const limit = limitStr ? Number(limitStr) : 200;
    if (!Number.isFinite(limit) || limit < 1 || limit > 500) {
      return badRequest("limit must be between 1 and 500");
    }

    const logs = await getAuditLogs({
      userId,
      teamCode,
      action,
      entity,
      entityId,
      tripId,
      from,
      to,
      limit,
    });

    return ok({ logs, count: logs.length });
  } catch (e) {
    return serverError(e);
  }
}
