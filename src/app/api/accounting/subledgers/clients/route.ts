import { requireAuth, authorize, ok, serverError, unauthorized } from "@/lib/api";
import { listClientSubledgerSummaries } from "@/lib/accounting/client-subledger.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const denied = await authorize(auth, "accounting.subledger.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const result = await listClientSubledgerSummaries({ limit, offset });
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
