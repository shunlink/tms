import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { verifyPod, rejectPod, markBadPodAsGood } from "@/lib/services/pod.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "verify") {
      const denied = await authorize(auth, "pod.approve");
      if (denied) return denied;
      const loadingCharge = body.loadingCharge != null ? Number(body.loadingCharge) : 0;
      const unloadingCharge = body.unloadingCharge != null ? Number(body.unloadingCharge) : 0;
      const result = await verifyPod(params.id, auth!.user, { loadingCharge, unloadingCharge });
      if (!result) return notFound("POD not found or not pending verification");
      return ok(result);
    }

    if (action === "mark_good") {
      const denied = await authorize(auth, "pod.approve");
      if (denied) return denied;
      const loadingCharge = body.loadingCharge != null ? Number(body.loadingCharge) : 0;
      const unloadingCharge = body.unloadingCharge != null ? Number(body.unloadingCharge) : 0;
      const result = await markBadPodAsGood(params.id, auth!.user, {
        loadingCharge,
        unloadingCharge,
      });
      if (!result) return notFound("POD not found or not a bad POD");
      return ok(result);
    }

    if (action === "reject") {
      const denied = await authorize(auth, "pod.manage");
      if (denied) return denied;
      const reason = body.rejectionReason ?? body.remarks ?? null;
      const result = await rejectPod(params.id, reason, auth!.user);
      if (!result) return notFound("POD not found or not pending verification");
      return ok(result);
    }

    return badRequest("action must be 'verify', 'reject', or 'mark_good'");
  } catch (e) {
    return serverError(e);
  }
}
