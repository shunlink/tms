/** Map a Requirement record to IndentForm initial field values (prefill only — no DB write). */

type RequirementRow = {
  id: string;
  clientId: string;
  routeFrom: string;
  routeTo: string;
  vehicleTypeCode: string;
  vehicleQuantity: number;
  cargoSummary: string | null;
  expectedAt: Date | null;
  clientRate: { toNumber(): number } | null;
  bodyTypeCode: string | null;
  insuranceType: string | null;
  cargoTypeCode: string | null;
  capacityCbm: { toNumber(): number } | null;
  weightValue: { toNumber(): number } | null;
  weightUnit: string | null;
  packageCount: number | null;
  materialDescription: string | null;
  packingType: string | null;
  materialValue: { toNumber(): number } | null;
  hsnCode: string | null;
  freightType: string | null;
  paymentMode: string | null;
  pickupAt: Date | null;
  deliveryAt: Date | null;
  specialInstructions: string | null;
  consignorName: string | null;
  consignorCity: string | null;
  consignorState: string | null;
  consignorPincode: string | null;
  consignorAddress: string | null;
  consignorContact: string | null;
  consignorPhone: string | null;
  consigneeName: string | null;
  consigneeCity: string | null;
  consigneeState: string | null;
  consigneePincode: string | null;
  consigneeAddress: string | null;
  consigneeContact: string | null;
  consigneePhone: string | null;
  client?: { name: string };
};

function dateInput(d: Date | null | undefined) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function timeInput(d: Date | null | undefined) {
  if (!d) return "";
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function num(v: { toNumber(): number } | number | null | undefined) {
  if (v == null) return "";
  return String(typeof v === "number" ? v : v.toNumber());
}

export function mapRequirementToIndentFormValues(req: RequirementRow) {
  const pickup = req.pickupAt ?? req.expectedAt;
  return {
    indentDate: dateInput(new Date()),
    serviceType: "GTA",
    transactionType: "SPOT",
    insuranceType: req.insuranceType ?? "NONE",
    cargoType: req.cargoTypeCode ?? "GENERAL",
    consignorName: req.consignorName || req.client?.name || "",
    consignorAddress: req.consignorAddress || req.routeFrom || "",
    consignorCity: req.consignorCity || req.routeFrom || "",
    consignorState: req.consignorState || "",
    consignorPincode: req.consignorPincode || "",
    consignorGstin: "",
    consignorContact: req.consignorContact || "",
    consignorPhone: req.consignorPhone || "",
    pickupDate: dateInput(pickup),
    pickupTime: timeInput(pickup),
    consigneeName: req.consigneeName || "",
    consigneeAddress: req.consigneeAddress || req.routeTo || "",
    consigneeCity: req.consigneeCity || req.routeTo || "",
    consigneeState: req.consigneeState || "",
    consigneePincode: req.consigneePincode || "",
    consigneeGstin: "",
    consigneeContact: req.consigneeContact || "",
    consigneePhone: req.consigneePhone || "",
    deliveryDate: dateInput(req.deliveryAt),
    deliveryTime: timeInput(req.deliveryAt),
    podDueAt: "",
    vehicleType: req.vehicleTypeCode,
    bodyType: req.bodyTypeCode || "",
    quantity: String(req.vehicleQuantity ?? 1),
    capacityCbm: num(req.capacityCbm),
    materialDescription: req.materialDescription || req.cargoSummary || "",
    packingType: req.packingType || "",
    packageCount: req.packageCount != null ? String(req.packageCount) : "",
    weightValue: num(req.weightValue),
    weightUnit: req.weightUnit ?? "MT",
    weightKg: "",
    materialValue: num(req.materialValue),
    hsnCode: req.hsnCode || "",
    invoiceNumber: "",
    invoiceValue: "",
    clientRate: num(req.clientRate),
    freightType: req.freightType || "FOR",
    paymentMode: req.paymentMode || "TBB",
    specialInstructions: req.specialInstructions || "",
    remarks: "",
  };
}
