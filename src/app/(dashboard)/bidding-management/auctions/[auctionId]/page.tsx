import { redirect } from "next/navigation";
import AuctionDetailSection from "@/components/bidding/auction-detail-section";
import { requireInternalSession } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function BiddingAuctionDetailPage({
  params,
  searchParams,
}: {
  params: { auctionId: string };
  searchParams: { requirementId?: string };
}) {
  const user = await requireInternalSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  const requirementId = searchParams.requirementId?.trim() ?? "";
  if (!requirementId) {
    redirect("/bidding-management");
  }

  return (
    <AuctionDetailSection
      auctionIdParam={params.auctionId ?? ""}
      requirementId={requirementId}
    />
  );
}
