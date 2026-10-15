import { requireAuth, authorize, safeOk } from "@/lib/api";
import { listImportantEvents } from "@/lib/services/important-event.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.view");
  if (denied) return denied;
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  return safeOk("importantEvents.list", () => listImportantEvents(status ? { status } : undefined), []);
}
