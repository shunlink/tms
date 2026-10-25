# Shunlink tax invoice layout (reference: BuckleTrack)

Source: `docs/pdf/invoice-format-buckletrack.pdf`

## Page

- **A4 portrait** (single page when line count is small; grows naturally with rows).
- **No QR / IRN / Ack / stamp / signature image.**

## Section order

1. Computer-generated banner + registered office line
2. Logo (Shunlink) · **Tax Invoice** · E. & O.E
3. **Quad grid:** Bill To | Invoice meta (no, date, ref, RCM, trip, booking, pickup, delivery) · Bill From | Due date, payment terms, delivery terms, SAC
4. **RCM / GTA remarks** bar
5. **Line table:** Sl.No., Particulars, LR No., Vehicle Type, Container No., Wt. (MT), Invoice No., Vehicle No., HSN/SAC, Amount (per trip / LR)
6. **Totals:** amount in words + LR remarks | Total, CGST/SGST/IGST, Grand Total
7. **Footer:** bank details + terms | “For {company}” (no signatory image)
8. Jurisdiction line

## Data mapping

See `loadInvoicePrintSnapshot` in `src/lib/services/invoice-document.service.ts`.
