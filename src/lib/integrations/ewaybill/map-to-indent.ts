import type { NormalizedEwayBill } from "./types";
import { gstStateNameFromCode } from "./indian-state-codes";

/** Fields on the indent form that can be prefilled from an E-Way Bill (not persisted until save). */
export type EwayBillIndentDraft = {
  consignorName?: string;
  consignorAddress?: string;
  consignorCity?: string;
  consignorState?: string;
  consignorPincode?: string;
  consignorGstin?: string;
  consigneeName?: string;
  consigneeAddress?: string;
  consigneeCity?: string;
  consigneeState?: string;
  consigneePincode?: string;
  consigneeGstin?: string;
  materialDescription?: string;
  hsnCode?: string;
  packageCount?: string;
  weightValue?: string;
  weightUnit?: string;
  materialValue?: string;
  invoiceNumber?: string;
  invoiceValue?: string;
};

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return undefined;
}

function joinAddress(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(", ") || undefined;
}

/** Parse NIC / portal dates like 26/09/2018 02:40:00 PM or 10/09/2018 → yyyy-mm-dd */
export function parseEwayPortalDate(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const d = value.trim().split(/\s+/)[0];
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d);
  if (!m) return undefined;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  return `${m[3]}-${month}-${day}`;
}

type EwayItem = {
  productName?: string;
  productDesc?: string;
  hsnCode?: number | string;
  quantity?: number;
  qtyUnit?: string;
};

function readItemList(raw: Record<string, unknown>): EwayItem[] {
  const list = raw.itemList ?? raw.ItemList;
  if (!Array.isArray(list)) return [];
  return list as EwayItem[];
}

export function buildIndentDraftFromEwayBill(
  data: NormalizedEwayBill,
  raw?: Record<string, unknown>
): EwayBillIndentDraft {
  const r = raw ?? {};
  const items = readItemList(r);

  const goodsFromItems = items
    .map((it) => [it.productName, it.productDesc].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("; ");

  const hsnFromItems = items
    .map((it) => (it.hsnCode != null ? String(it.hsnCode) : ""))
    .filter(Boolean)[0];

  const qtySum = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const qtyUnit = items.find((it) => it.qtyUnit)?.qtyUnit;

  const fromState =
    gstStateNameFromCode(pickString(r, "fromStateCode", "actFromStateCode")) ??
    data.origin ??
    undefined;
  const toState =
    gstStateNameFromCode(pickString(r, "toStateCode", "actToStateCode")) ??
    data.destination ??
    undefined;

  const invoiceValue =
    pickString(r, "totInvValue", "totalValue") ??
    (data.value != null ? String(data.value) : undefined);

  const draft: EwayBillIndentDraft = {
    consignorName: pickString(r, "fromTrdName") ?? undefined,
    consignorAddress: joinAddress(
      pickString(r, "fromAddr1"),
      pickString(r, "fromAddr2")
    ),
    consignorCity: pickString(r, "fromPlace") ?? data.origin ?? undefined,
    consignorState: fromState ?? undefined,
    consignorPincode: pickString(r, "fromPincode"),
    consignorGstin: pickString(r, "fromGstin", "userGstin") ?? data.supplierGstin ?? undefined,
    consigneeName: pickString(r, "toTrdName") ?? undefined,
    consigneeAddress: joinAddress(pickString(r, "toAddr1"), pickString(r, "toAddr2")),
    consigneeCity: pickString(r, "toPlace") ?? data.destination ?? undefined,
    consigneeState: toState ?? undefined,
    consigneePincode: pickString(r, "toPincode"),
    consigneeGstin: pickString(r, "toGstin") ?? data.recipientGstin ?? undefined,
    materialDescription: goodsFromItems || data.goodsDescription || undefined,
    hsnCode: hsnFromItems || data.hsnCode || undefined,
    packageCount: qtySum > 0 ? String(Math.round(qtySum)) : data.quantity || undefined,
    weightValue: qtySum > 0 ? String(qtySum) : undefined,
    weightUnit: qtyUnit?.trim() || undefined,
    materialValue: invoiceValue,
    invoiceNumber: pickString(r, "docNo") ?? data.documentNumber ?? undefined,
    invoiceValue,
  };

  return Object.fromEntries(
    Object.entries(draft).filter(([, v]) => v != null && String(v).trim() !== "")
  ) as EwayBillIndentDraft;
}
