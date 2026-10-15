import { validateBiddingIntegrationRequest } from "./auth";
import { onboardingSyncSchema } from "./schemas";
import { upsertPartyFromBiddingOnboardingSync } from "@/lib/services/bidding-integration.service";

export async function handleBiddingOnboardingSyncPost(req: Request) {
  const authError = validateBiddingIntegrationRequest(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = onboardingSyncSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join("; "), code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const result = await upsertPartyFromBiddingOnboardingSync(parsed.data);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
