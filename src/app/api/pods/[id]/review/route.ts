import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { verifyPod, rejectPod } from "@/lib/services/pod.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "verify") {
      const denied = await authorize(auth, "pod.approve");
      if (denied) return denied;
      const result = await verifyPod(params.id, auth!.user);
      if (!result) return notFound("POD not found or not pending verification");
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

    return badRequest("action must be 'verify' or 'reject'");
  } catch (e) {
    return serverError(e);
  }
}
