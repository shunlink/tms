import { handleBiddingOnboardingSyncPost } from "@/lib/integration/bidding/handle-onboarding-sync";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleBiddingOnboardingSyncPost(req);
}
