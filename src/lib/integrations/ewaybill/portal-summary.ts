import type { EwayBillIndentDraft } from "./map-to-indent";

/** Read-only fields from Perione GetEwayBill inner `response` (lite API). */
export type PerionePortalSummary = {
  ewbNo?: string;
  status?: string;
  fromPincode?: string;
  toPincode?: string;
  hsnCode?: string;
  ewayBillDate?: string;
  validUpto?: string;
  vehicleNo?: string;
};

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return undefined;
}

export function buildPerionePortalSummary(raw: Record<string, unknown> | undefined): PerionePortalSummary {
  if (!raw) return {};
  const vehicleNo = (() => {
    const list = raw.VehiclListDetails ?? raw.vehicleListDetails;
    if (!Array.isArray(list) || list.length === 0) return undefined;
    const row = list[list.length - 1] as Record<string, unknown>;
    return pickString(row, "vehicleNo", "vehicleNumber");
  })();

  const summary: PerionePortalSummary = {};
  const ewbNo = pickString(raw, "ewbNo", "ewayBillNo");
  if (ewbNo) summary.ewbNo = ewbNo;
  const status = pickString(raw, "status");
  if (status) summary.status = status;
  const fromPincode = pickString(raw, "fromPincode");
  if (fromPincode) summary.fromPincode = fromPincode;
  const toPincode = pickString(raw, "toPincode");
  if (toPincode) summary.toPincode = toPincode;
  const hsnCode = pickString(raw, "hsnCode");
  if (hsnCode) summary.hsnCode = hsnCode;
  const ewayBillDate = pickString(raw, "ewayBillDate");
  if (ewayBillDate) summary.ewayBillDate = ewayBillDate;
  const validUpto = pickString(raw, "validUpto", "validUntil");
  if (validUpto) summary.validUpto = validUpto;
  if (vehicleNo) summary.vehicleNo = vehicleNo;
  return summary;
}

export function portalSummaryToIndentPinDraft(summary: PerionePortalSummary): EwayBillIndentDraft {
  const draft: EwayBillIndentDraft = {};
  if (summary.fromPincode) draft.consignorPincode = summary.fromPincode;
  if (summary.toPincode) draft.consigneePincode = summary.toPincode;
  return draft;
}

/** Active status and validity extends through today (local date). */
export function isPerioneEwayValidToday(summary: PerionePortalSummary): boolean {
  const status = (summary.status ?? "").toUpperCase();
  if (status.includes("CAN") || status.includes("INV") || status.includes("EXP")) return false;
  if (status !== "ACT" && !status.includes("ACTIVE")) return false;

  const validRaw = summary.validUpto?.trim();
  if (!validRaw) return true;

  const datePart = validRaw.split(/\s+/)[0];
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(datePart);
  let validEnd: Date;
  if (slash) {
    validEnd = new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]), 23, 59, 59, 999);
  } else {
    validEnd = new Date(validRaw);
    if (Number.isNaN(validEnd.getTime())) return true;
    validEnd.setHours(23, 59, 59, 999);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return validEnd.getTime() >= todayStart.getTime();
}

export function portalSummaryDisplayRows(
  summary: PerionePortalSummary
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (summary.ewbNo) rows.push({ label: "E-Way Bill No.", value: summary.ewbNo });
  if (summary.status) rows.push({ label: "Status", value: summary.status });
  if (summary.fromPincode) rows.push({ label: "From pincode", value: summary.fromPincode });
  if (summary.toPincode) rows.push({ label: "To pincode", value: summary.toPincode });
  if (summary.hsnCode) rows.push({ label: "HSN", value: summary.hsnCode });
  if (summary.ewayBillDate) rows.push({ label: "E-Way Bill date", value: summary.ewayBillDate });
  if (summary.validUpto) rows.push({ label: "Valid upto", value: summary.validUpto });
  if (summary.vehicleNo) rows.push({ label: "Vehicle", value: summary.vehicleNo });
  return rows;
}
