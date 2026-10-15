import { fetchBiddingApi } from "./proxy";

export type BiddingOnboardingDecisionPayload = {
  biddingApplicationId: string;
  status: "APPROVED" | "REJECTED";
  remarks?: string | null;
};

/** Notify Bidding when TMS admin approves/rejects a linked onboarding case. */
export async function notifyBiddingOnboardingDecision(
  payload: BiddingOnboardingDecisionPayload
): Promise<void> {
  const result = await fetchBiddingApi("internal/tms/onboarding-decision", "POST", {
    biddingApplicationId: payload.biddingApplicationId,
    status: payload.status,
    remarks: payload.remarks ?? null,
  });
  if (!result.ok) {
    const detail =
      result.data && typeof result.data === "object" && "message" in result.data
        ? String((result.data as { message: unknown }).message)
        : JSON.stringify(result.data);
    throw new Error(`Bidding onboarding-decision failed (${result.status}): ${detail}`);
  }
}
