import { notFound } from "next/navigation";
import TripFinanceView from "@/components/trip-finance/trip-finance-view";
import { requireFinanceViewPermission } from "@/lib/page-auth";
import { getTripFinance } from "@/lib/services/trip-finance.service";

export const dynamic = "force-dynamic";

export default async function TripFinancePage({
  params,
}: {
  params: { tripId: string };
}) {
  await requireFinanceViewPermission();

  const finance = await getTripFinance(params.tripId);
  if (!finance) notFound();

  return <TripFinanceView finance={finance} />;
}
