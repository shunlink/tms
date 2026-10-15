import { requireAuth, authorize, ok, badRequest, notFound, serverError } from "@/lib/api";
import { allocationSchema, reallocationSchema, validate } from "@/lib/validation";
import { allocateVendor, reallocateVendor } from "@/lib/services/allocation.service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.allocate");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(allocationSchema, body);
    if (!parsed.success) return badRequest(parsed.error);

    const indent = await allocateVendor(params.id, parsed.data, auth!.user);
    if (!indent) return notFound("Indent not found");
    return ok(indent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Allocation failed";
    if (
      msg.includes("cannot be allocated") ||
      msg.includes("already used") ||
      msg.includes("Vendor is required") ||
      msg.includes("Vendor rate is required")
    ) {
      return badRequest(msg);
    }
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.reallocate");
  if (denied) return denied;
  try {
    const body = await req.json();
    const parsed = validate(reallocationSchema.partial(), body);
    if (!parsed.success) return badRequest(parsed.error);

    const indent = await reallocateVendor(
      params.id,
      {
        vendorId: body.vendorId ?? parsed.data.vendorId ?? null,
        quoteId: body.quoteId ?? parsed.data.quoteId ?? null,
        vendorRate: body.vendorRate ?? parsed.data.vendorRate ?? null,
        reason: parsed.data.reason ?? body.reason,
      },
      auth!.user
    );
    if (!indent) return notFound("Indent not found");
    return ok(indent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Reallocation failed";
    if (msg.includes("cannot be reallocated") || msg.includes("cannot be allocated")) return badRequest(msg);
    return serverError(e);
  }
}
