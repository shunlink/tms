import type { EwayBillSource, NormalizedEwayBill } from "./types";

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/,/g, ""));
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

export function normalizeSurepassEwayBill(
  ebn: string,
  raw: Record<string, unknown>,
  source: EwayBillSource = "CLIENT_PROVIDED",
  provider = "surepass"
): NormalizedEwayBill {
  return {
    ewayBillNumber: pickString(raw, "eway_bill_number", "ewb_no", "ewb_number", "ewayBillNo") ?? ebn,
    status: pickString(raw, "eway_bill_status", "status", "validity"),
    supplierGstin: pickString(raw, "from_gstin", "supplier_gstin", "fromGstin"),
    recipientGstin: pickString(raw, "to_gstin", "recipient_gstin", "toGstin"),
    documentType: pickString(raw, "doc_type", "document_type", "docType"),
    documentNumber: pickString(raw, "doc_no", "document_number", "docNo"),
    documentDate: pickString(raw, "doc_date", "document_date", "docDate"),
    goodsDescription: pickString(raw, "goods_description", "item_list", "product_name", "goods"),
    hsnCode: pickString(raw, "hsn_code", "hsnCode"),
    quantity: pickString(raw, "quantity", "total_quantity", "qty"),
    value: pickNumber(raw, "total_value", "value", "taxable_amount", "invoice_value"),
    origin: pickString(raw, "from_place", "from_state", "origin", "fromPlace"),
    destination: pickString(raw, "to_place", "to_state", "destination", "toPlace"),
    transporterName: pickString(raw, "transporter_name", "transporterName"),
    transporterGstin: pickString(raw, "transporter_id", "transporter_gstin", "transporterGstin"),
    vehicleNumber: pickString(raw, "vehicle_number", "vehicle_no", "vehicleNo"),
    validFrom: pickString(raw, "valid_from", "eway_bill_date", "generated_date"),
    validUntil: pickString(raw, "valid_upto", "valid_until", "validUpto"),
    provider,
    fetchedAt: new Date().toISOString(),
    source,
  };
}

export function isEwayBillExpired(data: Pick<NormalizedEwayBill, "status" | "validUntil">): boolean {
  const status = (data.status ?? "").toLowerCase();
  if (status.includes("cancel") || status.includes("invalid") || status.includes("expired")) {
    return true;
  }
  if (data.validUntil) {
    const d = new Date(data.validUntil);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return true;
  }
  return false;
}
