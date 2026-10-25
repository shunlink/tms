/** First two digits of GSTIN = state code (India). */
export function gstStateCode(gstin: string | null | undefined): string | null {
  const t = gstin?.trim();
  if (!t || t.length < 2) return null;
  const code = t.slice(0, 2);
  return /^\d{2}$/.test(code) ? code : null;
}

export function isInterStateSupply(
  supplierGstin: string,
  recipientGstin: string | null | undefined
): boolean {
  const s = gstStateCode(supplierGstin);
  const r = gstStateCode(recipientGstin);
  if (!s || !r) return false;
  return s !== r;
}

export type GstSplitAmounts = {
  cgst: number;
  sgst: number;
  igst: number;
};

/** Split total GST into CGST+SGST (half each) or IGST (full). */
export function splitGstAmount(totalGst: number, interState: boolean): GstSplitAmounts {
  const g = Math.round(totalGst * 100) / 100;
  if (interState) {
    return { cgst: 0, sgst: 0, igst: g };
  }
  const half = Math.round((g / 2) * 100) / 100;
  const other = Math.round((g - half) * 100) / 100;
  return { cgst: half, sgst: other, igst: 0 };
}
