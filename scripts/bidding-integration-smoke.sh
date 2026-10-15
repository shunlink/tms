#!/usr/bin/env bash
# Smoke test Bidding ↔ TMS integration against a local TMS instance.
# Requires: curl, jq (optional for pretty output)
#
# Env:
#   TMS_URL                          default http://localhost:3000
#   BIDDING_TMS_INTEGRATION_SECRET   required
#   SMOKE_CLIENT_COMPANY_ID          default smoke_client_cmp
#   SMOKE_VENDOR_COMPANY_ID          default smoke_vendor_cmp
#   SMOKE_APPLICATION_ID             default smoke_app_client_1
#   SMOKE_LOAD_REQUIREMENT_ID        default smoke_lr_1
#   SMOKE_BID_ID                     default smoke_bid_1

set -euo pipefail

TMS_URL="${TMS_URL:-http://localhost:3000}"
SECRET="${BIDDING_TMS_INTEGRATION_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "BIDDING_TMS_INTEGRATION_SECRET is required" >&2
  exit 1
fi

CLIENT_CMP="${SMOKE_CLIENT_COMPANY_ID:-smoke_client_cmp}"
VENDOR_CMP="${SMOKE_VENDOR_COMPANY_ID:-smoke_vendor_cmp}"
APP_ID="${SMOKE_APPLICATION_ID:-smoke_app_client_1}"
LR_ID="${SMOKE_LOAD_REQUIREMENT_ID:-smoke_lr_1}"
BID_ID="${SMOKE_BID_ID:-smoke_bid_1}"
TS="$(date +%s)"

auth=( -H "Authorization: Bearer ${SECRET}" -H "Content-Type: application/json" )

echo "==> POST onboarding-approved (CLIENT)"
onboard_body=$(cat <<EOF
{
  "idempotencyKey": "smoke:onboarding:client:${TS}",
  "partyType": "CLIENT",
  "biddingCompanyId": "${CLIENT_CMP}",
  "biddingApplicationId": "${APP_ID}",
  "snapshot": {
    "legalName": "Smoke Test Client",
    "tradeName": "Smoke Client",
    "contactName": "Smoke",
    "phone": "+919999999901",
    "email": "smoke-client@example.com",
    "documents": []
  }
}
EOF
)
curl -sS -X POST "${TMS_URL}/api/integration/bidding/onboarding-approved" "${auth[@]}" -d "$onboard_body"
echo ""

echo "==> POST onboarding-approved (VENDOR)"
vendor_app="smoke_app_vendor_${TS}"
onboard_vendor=$(cat <<EOF
{
  "idempotencyKey": "smoke:onboarding:vendor:${TS}",
  "partyType": "VENDOR",
  "biddingCompanyId": "${VENDOR_CMP}",
  "biddingApplicationId": "${vendor_app}",
  "snapshot": {
    "legalName": "Smoke Test Vendor",
    "tradeName": "Smoke Vendor",
    "contactName": "Smoke",
    "phone": "+919999999902",
    "documents": []
  }
}
EOF
)
curl -sS -X POST "${TMS_URL}/api/integration/bidding/onboarding-approved" "${auth[@]}" -d "$onboard_vendor"
echo ""

echo "==> POST award-handoff"
award_body=$(cat <<EOF
{
  "idempotencyKey": "smoke:handoff:${LR_ID}:${BID_ID}:${TS}",
  "loadRequirementId": "${LR_ID}_${TS}",
  "bidId": "${BID_ID}_${TS}",
  "bidAcceptanceId": "acc_${TS}",
  "clientBiddingCompanyId": "${CLIENT_CMP}",
  "vendorBiddingCompanyId": "${VENDOR_CMP}",
  "clientPriceInr": 45000,
  "vendorPriceInr": 38000,
  "lane": {
    "from": { "city": "Pune", "state": "MH" },
    "to": { "city": "Mumbai", "state": "MH" }
  },
  "cargo": {
    "materialDescription": "Smoke cargo",
    "vehicleCategory": "OPEN_BODY",
    "weightValue": 10,
    "weightUnit": "MT"
  },
  "placement": { "vehicleRegistration": null, "driver": null }
}
EOF
)
award_resp=$(curl -sS -X POST "${TMS_URL}/api/integration/bidding/award-handoff" "${auth[@]}" -d "$award_body")
echo "$award_resp"
echo ""

echo "==> GET vendor trips (expect indent row, tripId null, PLACEMENT_PENDING)"
curl -sS "${TMS_URL}/api/integration/bidding/vendor/trips?biddingCompanyId=${VENDOR_CMP}" "${auth[@]}"
echo ""

echo "Smoke finished."
