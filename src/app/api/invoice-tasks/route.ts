import { requireAuth, authorize, ok, serverError, safeOk } from "@/lib/api";
import { listInvoiceTasks } from "@/lib/services/invoice-task.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "invoice.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const slaBreachedOnly = url.searchParams.get("slaBreached") === "true";
    const status = url.searchParams.get("status") ?? undefined;

    return safeOk(
      "invoice-tasks.list",
      () => listInvoiceTasks({ status, slaBreachedOnly }),
      []
    );
  } catch (e) {
    return serverError(e);
  }
}
