import { requireAuth, authorize, safeOk } from "@/lib/api";
import { getPlacementQueue } from "@/lib/queries";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "placement.view");
  if (denied) return denied;
  return safeOk("placement.list", () => getPlacementQueue(), []);
}
