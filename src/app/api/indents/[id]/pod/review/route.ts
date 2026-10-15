import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { approvePod, rejectPodByIndent, verifyPod, rejectPod } from "@/lib/services/pod.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const podId = body.podId ? String(body.podId) : null;

    if (action === "approve" || action === "verify") {
      const denied = await authorize(auth, "pod.approve");
      if (denied) return denied;
      if (podId) {
        const result = await verifyPod(podId, auth!.user);
        if (!result) return notFound("POD not found or not pending verification");
        return ok(result);
      }
      const result = await approvePod(params.id, auth!.user);
      if (!result) return notFound("No pending POD for this indent");
      return ok(result);
    }

    if (action === "reject") {
      const denied = await authorize(auth, "pod.manage");
      if (denied) return denied;
      const reason = body.rejectionReason ?? body.remarks ?? null;
      if (podId) {
        const result = await rejectPod(podId, reason, auth!.user);
        if (!result) return notFound("POD not found or not pending verification");
        return ok(result);
      }
      const result = await rejectPodByIndent(params.id, reason, auth!.user);
      if (!result) return notFound("No pending POD for this indent");
      return ok(result);
    }

    return badRequest("action must be 'verify' or 'reject'");
  } catch (e) {
    return serverError(e);
  }
}
