# Shunlink LR layout (reference: BuckleTrack)

Source sample: `docs/pdf/buckletrack-lr-sample.pdf` and BuckleTrack production LR screenshots.

## Page structure

- **2× A4 portrait pages** — **two full LR blocks per page**, separated by a **horizontal dashed cut line**.
- Page 1: **Shipper Copy** (top) · **Consignee Copy** (bottom).
- Page 2: **Driver Copy** (top) · **Accounts Copy** (bottom).
- **No QR code** on Shunlink LR.

## Per-copy blocks (top → bottom)

1. **Header:** “Lorry Receipt – Non-Negotiable”, Shunlink legal name/address/PAN/GST, **Shunlink logo** (`public/brand/logo-light.svg`), grey **copy badge**.
2. **Blue bar:** SHIPPER (consignor name) · LR NUMBER · BOOKING DATE (dd/MM/yyyy).
3. **Consignor / consignee** table + **vehicle/driver** side panel (customer code, reg, type, driver, route, indent).
4. **GOODS DESC** line.
5. **Cargo row:** shipper invoice nos, declared value, packages, gross/chargeable weight, insurance.
6. **E-way row:** number, validity, freight/comments.
7. **Acknowledgement** + **shipper declaration** (short text).
8. **PROOF OF DELIVERY:** DATE and TIME lines, receiver text, signature line, consignee seal box.
9. **Footer:** jurisdiction / terms.

## Data sources

See [`lr-document.service.ts`](../src/lib/services/lr-document.service.ts) `loadTripLrSnapshot` — `Trip`, `Indent*`, `Vehicle`, `Driver`, `Vendor`, `companyProfile`.
