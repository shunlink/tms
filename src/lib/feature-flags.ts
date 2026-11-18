/**
 * External Bidding platform admin UI (live auction desk in TMS sidebar).
 * Hidden by default.
 *
 * Must be baked at `next build` for the client sidebar:
 *   NEXT_PUBLIC_BIDDING_ADMIN_UI_ENABLED=true
 * (Docker: set in Dockerfile / build arg — runtime env alone is not enough.)
 */
export function isBiddingAdminUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BIDDING_ADMIN_UI_ENABLED === "true";
}
