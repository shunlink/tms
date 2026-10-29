import { redirect } from "next/navigation";
import { isBiddingAdminUiEnabled } from "@/lib/feature-flags";

export default function BiddingManagementLayout({ children }: { children: React.ReactNode }) {
  if (!isBiddingAdminUiEnabled()) {
    redirect("/");
  }
  return children;
}
