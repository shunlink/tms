# Bidding ↔ TMS integration

Server-to-server APIs under `/api/integration/bidding`. Bidding calls TMS with a shared secret; vendor read APIs resolve `Vendor.id` from `biddingCompanyId`.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `BIDDING_TMS_INTEGRATION_SECRET` | Yes (integration routes) | Shared secret. `Authorization: Bearer <secret>` or `X-TMS-Integration-Secret`. |
| `BIDDING_SERVICE_URL` | For doc ingest | Base URL of Bidding (e.g. `http://localhost:3001/bidding`). Used to resolve relative `downloadUrl` and `documentId` preview paths. |
| `BIDDING_TMS_ADMIN_SECRET` | For internal doc URLs | Bearer token when TMS fetches Bidding `/api/internal/tms-admin/documents/{id}/preview` (or other `/api/internal/*` paths on the Bidding host). |

Integration routes are excluded from NextAuth middleware (`src/middleware.ts`).

## Auth

All routes require a valid integration secret. Missing configuration returns `503` with `INTEGRATION_DISABLED`.

## Error codes (award-handoff)

| HTTP | `code` | When | Bidding outbox |
|------|--------|------|----------------|
| 400 | `VALIDATION_ERROR` | Zod parse failure, unknown `vehicleTypeCode` / `bodyTypeCode`, bad `weightUnit` | **FAILED** (do not retry) |
| 404 | `PARTY_NOT_LINKED` | `clientBiddingCompanyId` or `vendorBiddingCompanyId` not found on TMS party | **FAILED** until onboarding handoff completes |
| 404 | `PARTY_NOT_LINKED` | Response includes `details.party`: `CLIENT` \| `VENDOR` | |
| 503 | `INTEGRATION_DISABLED` | Missing `BIDDING_TMS_INTEGRATION_SECRET` | Retry later |
| 500 | `INTERNAL_ERROR` | Unexpected server error | Retry with backoff |

Example:

```json
{
  "error": "Client not linked to Bidding company",
  "code": "PARTY_NOT_LINKED",
  "details": { "party": "CLIENT" }
}
```

## Vehicle type mapping

### TMS `cargo.vehicleTypeCode` (canonical)

Accepted TMS codes (stored on `IndentConsignment.vehicleTypeCode`):

| Code | Notes |
|------|--------|
| `TEMPO_14FT` | |
| `TRUCK_17FT` | Default when Bidding sends `vehicleCategory: OTHER` only |
| `TRUCK_20FT` | |
| `TRUCK_22FT` | |
| `TRUCK_32FT_SINGLE` | |
| `TRUCK_32FT_MULTI` | Alias: `TRUCK_32FT` |
| `CONTAINER_20FT` | Alias: `CONTAINER` |
| `CONTAINER_40FT` | |
| `TANKER` | |
| `TRAILER` | |

**Unknown TMS code** → `400` `VALIDATION_ERROR` (no silent default).

### Bidding `cargo.vehicleCategory`

When Bidding sends a category instead of a TMS code (field `vehicleCategory`, or the same enum value in `vehicleTypeCode`):

| Bidding category | TMS `vehicleTypeCode` | Default `bodyTypeCode` if omitted |
|------------------|----------------------|-----------------------------------|
| `OPEN_BODY` | `TRUCK_32FT_MULTI` | `OPEN` |
| `CONTAINER` | `CONTAINER_20FT` | `CLOSED` |
| `TRAILER` | `TRAILER` | `OPEN` |
| `TANKER` | `TANKER` | `Tanker` |
| `REFRIGERATED` | `TRUCK_32FT_MULTI` | `Closed` |
| `OTHER` | `TRUCK_17FT` | (none) |

Explicit `bodyTypeCode` on the payload overrides the category default.

### TMS `cargo.bodyTypeCode`

Accepted values: `OPEN`, `CLOSED`, `Open`, `Closed`, `Container`, `Flatbed`, `Tanker` (same set as the TMS indent UI). Unknown body → `VALIDATION_ERROR`.

### `weightUnit`

`MT` or `KG` only.

Implementation: `src/lib/integration/bidding/vehicle-mapping.ts`.

---

## Onboarding document ingest

**Supported in Phase 2:**

1. **`downloadUrl`** — absolute `https://…`, or a path relative to `BIDDING_SERVICE_URL` (e.g. `/api/internal/tms-admin/documents/abc/preview`).
2. **`documentId`** — shorthand; TMS builds `{BIDDING_SERVICE_URL}/api/internal/tms-admin/documents/{documentId}/preview`.

For URLs on the Bidding host under `/api/internal/`, TMS sends `Authorization: Bearer {BIDDING_TMS_ADMIN_SECRET}`.

**Not supported:** `storageKey`-only payloads (no TMS fetch). Bidding should expose a preview URL or `documentId`.

Ingest is best-effort: failures do not fail onboarding handoff.

Example document entry:

```json
{
  "documentType": "GST_CERT",
  "fileName": "gst.pdf",
  "documentId": "doc_abc123",
  "mimeType": "application/pdf"
}
```

---

## Routes

### `POST /api/integration/bidding/onboarding-approved`

Creates or updates `Client` / `Vendor` from an approved Bidding application snapshot.

**Request**

```json
{
  "idempotencyKey": "onboarding:app_abc123",
  "partyType": "CLIENT",
  "biddingCompanyId": "cmp_xyz",
  "biddingApplicationId": "app_abc123",
  "approvedAt": "2026-10-11T10:00:00Z",
  "snapshot": {
    "legalName": "Acme Logistics Pvt Ltd",
    "tradeName": "Acme",
    "gstin": "29AAAAA0000A1Z5",
    "pan": "AAAAA0000A",
    "contactName": "Jane Doe",
    "phone": "+919876543210",
    "email": "ops@acme.com",
    "registeredAddress": {
      "line1": "123 MG Road",
      "city": "Bengaluru",
      "state": "KA",
      "pincode": "560001"
    },
    "bank": { "accountHolder": "Acme", "ifsc": "HDFC0001234", "accountNumber": "1234567890" },
    "documents": [
      {
        "documentType": "GST_CERT",
        "fileName": "gst.pdf",
        "documentId": "doc_abc123",
        "mimeType": "application/pdf"
      }
    ]
  },
  "actor": { "tmsUserId": "user_cuid", "email": "admin@shunlink.com" }
}
```

**Response `201` / `200`**

```json
{
  "tmsPartyId": "cuid...",
  "partyType": "CLIENT",
  "biddingCompanyId": "cmp_xyz",
  "created": true,
  "onboardingCaseId": "cuid..."
}
```

Idempotent on `idempotencyKey`, `biddingApplicationId`, or `biddingCompanyId`.

---

### `POST /api/integration/bidding/award-handoff`

Creates a Bidding-sourced indent and allocates the awarded vendor in one transaction.

**Request**

```json
{
  "idempotencyKey": "tms-handoff:lr_123:bid_456",
  "loadRequirementId": "lr_123",
  "bidId": "bid_456",
  "bidAcceptanceId": "acc_789",
  "clientBiddingCompanyId": "cmp_client",
  "vendorBiddingCompanyId": "cmp_vendor",
  "clientPriceInr": 45000,
  "vendorPriceInr": 38000,
  "lane": {
    "from": { "city": "Pune", "state": "MH", "pincode": "411001", "addressLine1": "Plant" },
    "to": { "city": "Mumbai", "state": "MH", "pincode": "400001", "addressLine1": "Warehouse" }
  },
  "cargo": {
    "materialDescription": "Steel coils",
    "vehicleCategory": "OPEN_BODY",
    "vehicleTypeCode": "TRUCK_32FT_MULTI",
    "bodyTypeCode": "OPEN",
    "weightValue": 18,
    "weightUnit": "MT",
    "reportingAt": "2026-10-12T06:00:00+05:30"
  },
  "placement": { "vehicleRegistration": null, "driver": null }
}
```

Use either `vehicleCategory` or a canonical `vehicleTypeCode` (not both required; category wins when set).

**Response `201` / `200`**

```json
{
  "idempotencyKey": "tms-handoff:lr_123:bid_456",
  "indentId": "cuid",
  "indentNumber": "IND-2026-001234",
  "tripId": null,
  "tripNumber": null,
  "status": { "indent": "PLACEMENT_PENDING", "placement": "PLACEMENT_PENDING" },
  "created": true
}
```

---

### `GET /api/integration/bidding/vendor/trips?biddingCompanyId=...`

Lists Bidding-sourced work for the vendor:

- Trips whose indent has `source = BIDDING`
- **Indents allocated to the vendor with no trip yet** (e.g. `status` / `placementStatus` `PLACEMENT_PENDING` after award handoff)

Indent-only rows use `kind: "indent"`, `tripId: null`, `indentNumber` set, `displayStatus` typically `PLACEMENT_PENDING`.

**Response**

```json
{
  "items": [
    {
      "tripId": null,
      "lrNumber": "IND-2026-001234",
      "indentId": "cuid",
      "indentNumber": "IND-2026-001234",
      "route": "Pune → Mumbai",
      "clientName": "Acme",
      "vendorRateInr": 38000,
      "displayStatus": "PLACEMENT_PENDING",
      "rawTripStatus": null,
      "biddingLoadRequirementId": "lr_123",
      "kind": "indent"
    }
  ],
  "nextCursor": null
}
```

---

### `GET /api/integration/bidding/vendor/trips/:tripId?biddingCompanyId=...`

Trip detail (vendor portal fields) plus `biddingLoadRequirementId` and latest POD state.

---

### `POST /api/integration/bidding/vendor/trips/:tripId/pod?biddingCompanyId=...`

`multipart/form-data`: `front`, `back`, optional `remarks`.

**Response `201`**

```json
{ "podId": "...", "status": "PENDING_VERIFICATION", "indentId": "..." }
```

---

### `GET /api/integration/bidding/vendor/payments-summary?biddingCompanyId=...`

```json
{
  "outstandingPayableInr": 125000.5,
  "paidLifetimeInr": 890000,
  "recentPayments": []
}
```

## Status mapping after award handoff

| Field | Value |
|-------|--------|
| `Indent.source` | `BIDDING` |
| `Indent.allocationMode` | `MANUAL` |
| `Indent.status` | `PLACEMENT_PENDING` |
| `Indent.placementStatus` | `PLACEMENT_PENDING` |
| `IndentLine.status` | `ALLOCATED` |
| `Trip` | none until placement completes |

## Ops continuation (placement → trip)

1. Vendor / ops marks vehicle at loading (`placement` workflow in TMS).
2. Assign vehicle and driver on the indent (dashboard placement queue).
3. When placement reaches `VEHICLE_REACHED`, create trip via existing `createTripFromIndent` flow.
4. Trip progresses through dispatch, delivery, POD upload (vendor portal or Bidding proxy POD API), verification, and finance as for manual indents.

Manual `POST /api/indents`, allocation desk, and vendor portal login are unchanged.

## Local smoke test

```bash
export BIDDING_TMS_INTEGRATION_SECRET=your-secret
npm run bidding:smoke
```

Optional: `TMS_URL`, `SMOKE_CLIENT_COMPANY_ID`, `SMOKE_VENDOR_COMPANY_ID`. See `scripts/bidding-integration-smoke.sh`.
