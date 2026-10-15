import { requireAuth, authorize, safeOk } from "@/lib/api";
import {
  getReceivablesSummary,
  listReceivablesPaginated,
  parseReceivablesFilters,
  parseReceivablesSort,
} from "@/lib/services/receivables.service";

export async function GET(req: Request) {
  const auth = await requireAuth();
  const denied = await authorize(auth, "invoice.view");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const params = Object.fromEntries(searchParams.entries());
  const filters = parseReceivablesFilters(params);
  const sort = parseReceivablesSort(params);

  const includeSummary = searchParams.get("summary") === "1";

  return safeOk(
    "receivables.list",
    async () => {
      const [data, summary] = await Promise.all([
        listReceivablesPaginated(filters, params, sort),
        includeSummary ? getReceivablesSummary(filters) : Promise.resolve(null),
      ]);
      return { ...data, summary };
    },
    { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1, summary: null }
  );
}
