import { requireAuth, authorize, safeOk } from "@/lib/api";
import {
  getPayablesSummary,
  listPayablesPaginated,
  parsePayablesFilters,
  parsePayablesSort,
} from "@/lib/services/payables.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "payment.view");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const params = Object.fromEntries(searchParams.entries());
  const filters = parsePayablesFilters(params);
  const sort = parsePayablesSort(params);

  const includeSummary = searchParams.get("summary") === "1";

  return safeOk(
    "payables.list",
    async () => {
      const [data, summary] = await Promise.all([
        listPayablesPaginated(filters, params, sort),
        includeSummary ? getPayablesSummary(filters) : Promise.resolve(null),
      ]);
      return { ...data, summary };
    },
    { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1, summary: null }
  );
}
