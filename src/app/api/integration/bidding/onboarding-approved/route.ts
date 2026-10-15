import { handleBiddingOnboardingSyncPost } from "@/lib/integration/bidding/handle-onboarding-sync";

export const runtime = "nodejs";

/** @deprecated Prefer POST /api/integration/bidding/onboarding-sync */
export async function POST(req: Request) {
  return handleBiddingOnboardingSyncPost(req);
}
