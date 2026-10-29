/**
 * External Bidding platform admin UI (live auction desk in TMS sidebar).
 * Hidden by default. To show again, set in `.env`:
 *   NEXT_PUBLIC_BIDDING_ADMIN_UI_ENABLED=true
 * then restart the dev server.
 */
export function isBiddingAdminUiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BIDDING_ADMIN_UI_ENABLED === "true";
}
