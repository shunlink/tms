import { requireAuth, authorize, badRequest } from "@/lib/api";

/** @deprecated Use GET prefill + POST /api/indents after form review. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "indent.create");
  if (denied) return denied;
  return badRequest(
    `Use the indent form to review and save. Open /indents/new?requirementId=${params.id}`
  );
}
