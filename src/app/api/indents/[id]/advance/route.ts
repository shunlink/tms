import { requireAuth, authorize, ok, badRequest, notFound, serverError, unauthorized } from "@/lib/api";
import { advanceConfirmSchema, advanceDecisionSchema, advanceRequestSchema, validate } from "@/lib/validation";
import { confirmAdvance, decideAdvance, markAdvancePaid, requestAdvance } from "@/lib/services/advance.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "decide");

  try {
    if (action === "confirm") {
      const denied = await authorize(auth, "indent.edit");
      if (denied) return denied;
      const parsed = validate(advanceConfirmSchema, body);
      if (!parsed.success) return badRequest(parsed.error);
      const indent = await confirmAdvance(
        params.id,
        { amount: parsed.data.amount, remarks: parsed.data.remarks },
        auth.user
      );
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }

    if (action === "request") {
      const denied = await authorize(auth, "indent.edit");
      if (denied) return denied;
      const parsed = validate(advanceRequestSchema, body);
      if (!parsed.success) return badRequest(parsed.error);
      const indent = await requestAdvance(
        params.id,
        { requestedAmount: parsed.data.requestedAmount, remarks: parsed.data.remarks },
        auth.user
      );
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }

    if (action === "markPaid") {
      const denied = await authorize(auth, "advance.markPaid");
      if (denied) return denied;
      const indent = await markAdvancePaid(
        params.id,
        { mode: body.mode, referenceNo: body.referenceNo, paidAt: body.paidAt },
        auth.user
      );
      if (!indent) return notFound("Indent not found");
      return ok(indent);
    }

    const denied = await authorize(auth, "advance.decide");
    if (denied) return denied;
    const parsed = validate(advanceDecisionSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const indent = await decideAdvance(
      params.id,
      {
        requestedAmount: parsed.data.requestedAmount,
        approvedAmount: parsed.data.approvedAmount,
        status: parsed.data.status,
        remarks: parsed.data.remarks,
      },
      auth.user
    );
    if (!indent) return notFound("Indent not found");
    return ok(indent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Advance action failed";
    if (msg.includes("cannot receive") || msg.includes("cannot mark")) return badRequest(msg);
    return serverError(e);
  }
}
