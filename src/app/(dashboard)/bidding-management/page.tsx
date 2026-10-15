import { redirect } from "next/navigation";
import BiddingDashboard from "./BiddingDashboard";
import { requireInternalSession } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function BiddingManagementPage() {
  const user = await requireInternalSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return <BiddingDashboard />;
}
