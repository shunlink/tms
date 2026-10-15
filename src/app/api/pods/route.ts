import { requireAuth, authorize, ok, serverError } from "@/lib/api";
import { listPendingVerificationPods, listBadPodTasks } from "@/lib/services/pod.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "pod.view");
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "pending";

    if (view === "bad") {
      const tasks = await listBadPodTasks();
      return ok(tasks);
    }

    const pods = await listPendingVerificationPods();
    return ok(pods);
  } catch (e) {
    return serverError(e);
  }
}
