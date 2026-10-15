import type { IndentFormValues } from "@/components/forms/indent-form";

function dateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function str(v: unknown) {
  if (v == null || v === "") return "";
  return String(v);
}

/** Map a flat indent (from getIndentById) to IndentForm field values. */
export function indentFlatToFormValues(indent: {
  indentDate?: Date | string | null;
  consignorName?: string | null;
  consignorAddress?: string | null;
  consignorCity?: string | null;
  consignorState?: string | null;
  consignorPincode?: string | null;
  consignorGstin?: string | null;
  consignorContact?: string | null;
  consignorPhone?: string | null;
  pickupDate?: Date | string | null;
  pickupTime?: string | null;
  consigneeName?: string | null;
  consigneeAddress?: string | null;
  consigneeCity?: string | null;
  consigneeState?: string | null;
  consigneePincode?: string | null;
  consigneeGstin?: string | null;
  consigneeContact?: string | null;
  consigneePhone?: string | null;
  deliveryDate?: Date | string | null;
  deliveryTime?: string | null;
  serviceType?: string | null;
  transactionType?: string | null;
  insuranceType?: string | null;
  cargoType?: string | null;
  vehicleType?: string | null;
  bodyType?: string | null;
  quantity?: number | null;
  capacityCbm?: number | null;
  podDueAt?: Date | string | null;
  materialDescription?: string | null;
  packingType?: string | null;
  packageCount?: number | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  weightKg?: number | null;
  materialValue?: number | null;
  hsnCode?: string | null;
  invoiceNumber?: string | null;
  invoiceValue?: number | null;
  clientRate?: number | null;
  freightType?: string | null;
  paymentMode?: string | null;
  specialInstructions?: string | null;
  remarks?: string | null;
}): Partial<IndentFormValues> {
  return {
    indentDate: dateInput(indent.indentDate),
    consignorName: str(indent.consignorName),
    consignorAddress: str(indent.consignorAddress),
    consignorCity: str(indent.consignorCity),
    consignorState: str(indent.consignorState),
    consignorPincode: str(indent.consignorPincode),
    consignorGstin: str(indent.consignorGstin),
    consignorContact: str(indent.consignorContact),
    consignorPhone: str(indent.consignorPhone),
    pickupDate: dateInput(indent.pickupDate),
    pickupTime: str(indent.pickupTime),
    consigneeName: str(indent.consigneeName),
    consigneeAddress: str(indent.consigneeAddress),
    consigneeCity: str(indent.consigneeCity),
    consigneeState: str(indent.consigneeState),
    consigneePincode: str(indent.consigneePincode),
    consigneeGstin: str(indent.consigneeGstin),
    consigneeContact: str(indent.consigneeContact),
    consigneePhone: str(indent.consigneePhone),
    deliveryDate: dateInput(indent.deliveryDate),
    deliveryTime: str(indent.deliveryTime),
    serviceType: str(indent.serviceType) || "GTA",
    transactionType: str(indent.transactionType) || "SPOT",
    insuranceType: str(indent.insuranceType) || "NONE",
    cargoType: str(indent.cargoType) || "GENERAL",
    vehicleType: str(indent.vehicleType) || "TRUCK_17FT",
    bodyType: str(indent.bodyType),
    quantity: str(indent.quantity ?? 1),
    capacityCbm: str(indent.capacityCbm),
    podDueAt: dateInput(indent.podDueAt),
    materialDescription: str(indent.materialDescription),
    packingType: str(indent.packingType),
    packageCount: str(indent.packageCount),
    weightValue: str(indent.weightValue || indent.weightKg),
    weightUnit: str(indent.weightUnit) || "MT",
    weightKg: str(indent.weightKg),
    materialValue: str(indent.materialValue),
    hsnCode: str(indent.hsnCode),
    invoiceNumber: str(indent.invoiceNumber),
    invoiceValue: str(indent.invoiceValue),
    clientRate: str(indent.clientRate),
    freightType: str(indent.freightType) || "FOR",
    paymentMode: str(indent.paymentMode) || "TBB",
    specialInstructions: str(indent.specialInstructions),
    remarks: str(indent.remarks),
  };
}
