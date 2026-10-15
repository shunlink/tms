import { requireAuth, authorize, ok, safeOk } from "@/lib/api";
import { listTeams } from "@/lib/services/employee.service";

export async function GET() {
  const auth = await requireAuth();
  const denied = await authorize(auth, "users.manage");
  if (denied) return denied;
  return safeOk("teams.list", () => listTeams(), []);
}
