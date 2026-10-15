import { z } from "zod";
import { normalizePhone, normalizePhoneOrOriginal } from "./phone";
import {
  emailSchema,
  optionalEmailSchema,
  optionalGstinSchema,
  optionalPanSchema,
  optionalPincodeSchema,
  otpSchema,
  vehicleRegSchema,
  isValidIndianMobile,
} from "./field-validators";

export { otpSchema } from "./field-validators";

const optStr = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v == null ? null : v));

/**
 * Optional phone field. Always stored in canonical E.164 digits WITH the
 * country code (e.g. "9820012345" -> "919820012345") so it is ready to hand to
 * the WhatsApp Cloud API. Values that are not recognizable as a phone number
 * are kept as typed rather than silently dropped.
 */
const phoneStr = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v == null ? null : v))
  .refine((v) => v == null || isValidIndianMobile(v), {
    message: "Please enter a valid 10-digit Indian mobile number.",
  })
  .transform((v) => (v == null ? null : normalizePhone(v) ?? normalizePhoneOrOriginal(v)));

/** Required Indian mobile — canonical E.164 storage. */
const requiredPhone = (message = "Valid phone number is required") =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((v) => isValidIndianMobile(v), {
      message: "Please enter a valid 10-digit Indian mobile number.",
    })
    .transform((v) => normalizePhone(v) ?? normalizePhoneOrOriginal(v) ?? v);

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().nullable()
);

const optInt = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().nullable()
);

const optDate = z.preprocess(
  (v) => (v === "" || v == null ? null : new Date(v as string)),
  z.date().nullable()
);

const optBool = z.preprocess(
  (v) => v === true || v === "true" || v === "on" || v === 1 || v === "1",
  z.boolean()
);

export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES",
  "OPERATIONS",
  "FINANCE",
  "VENDOR_TEAM",
  "CLIENT",
  "VENDOR",
  "DRIVER",
] as const;

export const TEAM_CODES = [
  "ADMIN",
  "SALES",
  "OPERATIONS",
  "FINANCE",
  "VENDOR_TEAM",
] as const;

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  legalName: optStr,
  pan: optionalPanSchema,
  cin: optStr,
  msme: optStr,
  industry: optStr,
  website: optStr,
  contactName: optStr,
  phone: phoneStr,
  altPhone: phoneStr,
  email: optionalEmailSchema,
  accountsEmail: optionalEmailSchema,
  gstin: optionalGstinSchema,
  billingAddress: optStr,
  addressLine1: optStr,
  addressLine2: optStr,
  city: optStr,
  state: optStr,
  pincode: optionalPincodeSchema,
  country: optStr,
  shippingAddress: optStr,
  shippingCity: optStr,
  shippingState: optStr,
  shippingPincode: optionalPincodeSchema,
  creditLimit: optNum,
  paymentTerms: optInt,
  securityDeposit: optNum,
  bankName: optStr,
  bankAccount: optStr,
  bankIfsc: optStr,
  bankBranch: optStr,
  accountHolder: optStr,
  notes: optStr,
});

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(["FLEET_OWNER", "BROKER"]).default("FLEET_OWNER"),
  contactName: optStr,
  phone: phoneStr,
  altPhone: phoneStr,
  email: optionalEmailSchema,
  whatsapp: phoneStr,
  gstin: optionalGstinSchema,
  pan: optionalPanSchema,
  msme: optStr,
  addressLine1: optStr,
  addressLine2: optStr,
  city: optStr,
  state: optStr,
  pincode: optionalPincodeSchema,
  bankName: optStr,
  bankAccount: optStr,
  bankIfsc: optStr,
  bankBranch: optStr,
  accountHolder: optStr,
  upiId: optStr,
  paymentTerms: optInt,
  tdsApplicable: optBool,
  notes: optStr,
});

export const vehicleSchema = z.object({
  registrationNumber: vehicleRegSchema,
  number: z.string().trim().optional(), // legacy alias
  vendorId: z.string().optional().nullable().transform((v) => (v === "" ? null : v)),
  vehicleTypeCode: z.string().optional(),
  type: z.string().default("TRUCK_17FT"),
  bodyType: optStr,
  capacity: optStr,
  capacityTons: optNum,
  make: optStr,
  model: optStr,
  year: optInt,
  ownership: optStr,
  rcNumber: optStr,
  rcExpiry: optDate,
  ownerName: optStr,
  ownerPan: optStr,
  insuranceNumber: optStr,
  insuranceCompany: optStr,
  insuranceExpiry: optDate,
  insuranceValue: optNum,
  fitnessExpiry: optDate,
  pucNumber: optStr,
  pucExpiry: optDate,
  permitType: optStr,
  permitNumber: optStr,
  permitExpiry: optDate,
  gpsEnabled: optBool,
  gpsDeviceId: optStr,
  fastagId: optStr,
  remarks: optStr,
});

export const driverSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: requiredPhone(),
  dlNumber: z.string().trim().min(4, "DL number is required"),
  dlExpiry: optDate,
  address: optStr,
  city: optStr,
  state: optStr,
  pincode: optionalPincodeSchema,
  deviceType: z.enum(["SMARTPHONE", "FEATURE_PHONE"]).default("SMARTPHONE"),
});

/** Operational indent origin (see also Bidding award handoff: `source: BIDDING`). */
export const indentSourceSchema = z.enum(["ADMIN", "REQUIREMENT", "IMPORT", "BIDDING"]);

export const indentSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  requirementId: z.string().optional().nullable().transform((v) => (v === "" ? null : v)),
  indentDate: optDate,
  // consignment details
  serviceType: z.string().default("GTA"),
  transactionType: z.string().default("SPOT"),
  insuranceType: z.string().default("NONE"),
  cargoType: z.string().default("GENERAL"),
  // consignor
  consignorName: optStr,
  consignorAddress: optStr,
  consignorCity: optStr,
  consignorState: optStr,
  consignorPincode: optionalPincodeSchema,
  consignorGstin: optionalGstinSchema,
  consignorContact: optStr,
  consignorPhone: phoneStr,
  pickupDate: optDate,
  pickupTime: optStr,
  // consignee
  consigneeName: optStr,
  consigneeAddress: optStr,
  consigneeCity: optStr,
  consigneeState: optStr,
  consigneePincode: optionalPincodeSchema,
  consigneeGstin: optionalGstinSchema,
  consigneeContact: optStr,
  consigneePhone: phoneStr,
  deliveryDate: optDate,
  deliveryTime: optStr,
  podDueAt: optDate,
  // vehicle
  vehicleType: z.string().default("TRUCK_17FT"),
  bodyType: optStr,
  quantity: z.preprocess((v) => (v == null || v === "" ? 1 : Number(v)), z.number().int().positive()),
  capacityCbm: optNum,
  // material
  materialDescription: optStr,
  packingType: optStr,
  packageCount: optInt,
  weightValue: optNum,
  weightUnit: z.string().default("MT"),
  weightKg: optNum,
  materialValue: optNum,
  hsnCode: optStr,
  invoiceNumber: optStr,
  invoiceValue: optNum,
  // freight
  clientRate: optNum,
  freightType: optStr,
  paymentMode: optStr,
  ewayBillRequired: optBool,
  ewayBill: z
    .object({
      mode: z.enum(["EXISTING", "NONE", "MANUAL"]).optional(),
      ewayBillNumber: optStr,
      status: optStr,
      supplierGstin: optionalGstinSchema,
      recipientGstin: optionalGstinSchema,
      documentType: optStr,
      documentNumber: optStr,
      documentDate: optStr,
      goodsDescription: optStr,
      hsnCode: optStr,
      quantity: optStr,
      value: optNum,
      origin: optStr,
      destination: optStr,
      transporterName: optStr,
      transporterGstin: optionalGstinSchema,
      vehicleNumber: optStr,
      validFrom: optStr,
      validUntil: optStr,
      source: z.enum(["CLIENT_PROVIDED", "SHUNLINK_GENERATED", "MANUAL"]).optional(),
      provider: optStr,
      fetchedAt: optStr,
    })
    .optional()
    .nullable(),
  specialInstructions: optStr,
  remarks: optStr,
});

export type IndentInput = z.infer<typeof indentSchema>;

export const requirementSchema = z.object({
  clientId: z.string().optional(),
  routeFrom: z.string().trim().min(1, "Origin is required"),
  routeTo: z.string().trim().min(1, "Destination is required"),
  vehicleType: z.string().default("TRUCK_17FT"),
  quantity: z.preprocess((v) => (v == null || v === "" ? 1 : Number(v)), z.number().int().positive()),
  cargoDetails: optStr,
  expectedDate: optDate,
  clientRate: optNum,
  bodyType: optStr,
  insuranceType: optStr,
  cargoType: optStr,
  capacityCbm: optNum,
  weightValue: optNum,
  weightUnit: optStr,
  packageCount: optInt,
  materialDescription: optStr,
  packingType: optStr,
  materialValue: optNum,
  hsnCode: optStr,
  freightType: optStr,
  paymentMode: optStr,
  pickupDate: optDate,
  pickupTime: optStr,
  deliveryDate: optDate,
  deliveryTime: optStr,
  specialInstructions: optStr,
  consignorName: optStr,
  consignorCity: optStr,
  consignorState: optStr,
  consignorPincode: optionalPincodeSchema,
  consignorAddress: optStr,
  consignorContact: optStr,
  consignorPhone: phoneStr,
  consigneeName: optStr,
  consigneeCity: optStr,
  consigneeState: optStr,
  consigneePincode: optionalPincodeSchema,
  consigneeAddress: optStr,
  consigneeContact: optStr,
  consigneePhone: phoneStr,
});

export const tripSchema = z.object({
  clientId: z.string().min(1),
  vendorId: z.string().min(1),
  vehicleId: z.string().min(1),
  driverId: z.string().optional().nullable().transform((v) => (v === "" ? null : v)),
  requirementId: z.string().optional().nullable().transform((v) => (v === "" ? null : v)),
  routeFrom: z.string().trim().min(1, "Origin is required"),
  routeTo: z.string().trim().min(1, "Destination is required"),
  cargoDetails: optStr,
  loadingWeight: optNum,
  clientRate: z.coerce.number(),
  vendorRate: z.coerce.number(),
  status: z.string().optional(),
});

const invoiceLineSchema = z.object({
  tripId: z.string().min(1),
  amount: optNum,
  gstRate: optNum,
  description: optStr,
  lrNumber: optStr,
  routeFrom: optStr,
  routeTo: optStr,
  cargoSummary: optStr,
  vehicleReg: optStr,
  indentNumber: optStr,
});

const invoiceBillingSchema = z.object({
  billingName: optStr,
  billingGstin: optStr,
  billingAddress: optStr,
  billingEmail: optStr,
  paymentTermsDays: optInt,
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1),
  tripIds: z.array(z.string()).min(1, "Select at least one trip"),
  gstRate: z.preprocess((v) => (v == null || v === "" ? 0.18 : Number(v)), z.number().min(0).max(1)),
  billing: invoiceBillingSchema.optional(),
  lines: z.array(invoiceLineSchema).optional(),
});

export const paymentSchema = z.object({
  tripId: z.string().min(1),
  amount: optNum,
  advanceAmount: optNum,
  tdsAmount: optNum,
  paymentMode: optStr,
  referenceNo: optStr,
});

export const userSchema = z.object({
  email: emailSchema,
  name: optStr,
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(ROLES),
  teamId: optStr,
  employeeCode: optStr,
  jobTitle: optStr,
  clientId: optStr,
  vendorId: optStr,
  driverId: optStr,
});

export const userUpdateSchema = z.object({
  name: optStr,
  role: z.enum(ROLES).optional(),
  teamId: optStr,
  employeeCode: optStr,
  jobTitle: optStr,
  password: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(6).optional()
  ),
  clientId: optStr,
  vendorId: optStr,
  driverId: optStr,
  isActive: z.boolean().optional(),
});

export const indentWorkflowSchema = z.object({
  action: z.enum([
    "submit_for_approval",
    "approve",
    "reject",
    "record_advance",
    "mark_pod",
    "record_balance",
  ]),
  approvalRemarks: optStr,
  advanceAmount: optNum,
  advanceMode: optStr,
  advanceReference: optStr,
  balanceAmount: optNum,
  balanceMode: optStr,
  balanceReference: optStr,
});

// New workflow schemas (Indent as single source of truth)

export const indentReleaseSchema = z.object({
  cities: z.array(z.string().trim().min(1)).min(1, "Select at least one vendor city"),
});

export const advanceRequestSchema = z.object({
  requestedAmount: z.coerce.number().min(0, "Amount must be 0 or greater"),
  remarks: optStr,
});

export const advanceConfirmSchema = z.object({
  amount: z.coerce.number().min(0, "Amount must be 0 or greater"),
  remarks: optStr,
});

export const advanceDecisionSchema = z.object({
  requestedAmount: optNum,
  approvedAmount: optNum,
  status: z.enum(["PENDING", "APPROVED", "PAID", "REJECTED"]),
  mode: optStr,
  referenceNo: optStr,
  remarks: optStr,
});

export const internalAdvanceRaiseSchema = z.object({
  tripId: z.string().min(1, "Trip is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  remarks: optStr,
});

export const tripAdvanceRequestSchema = z.object({
  source: z.enum(["SHUNLINK", "EXTERNAL"]).default("SHUNLINK"),
  requestedAmount: z.coerce.number().positive("Amount must be greater than zero").optional(),
  externalProvider: optStr,
  remarks: optStr,
}).refine(
  (d) => d.source !== "SHUNLINK" || (d.requestedAmount != null && d.requestedAmount > 0),
  { message: "Requested amount is required for ShunLink advance", path: ["requestedAmount"] }
).refine(
  (d) => d.source !== "EXTERNAL" || Boolean(d.externalProvider?.trim()),
  { message: "External provider is required", path: ["externalProvider"] }
);

export const advanceNegotiateSchema = z.object({
  negotiatedAmount: z.coerce.number().positive("Negotiated amount must be greater than zero"),
  remarks: optStr,
});

export const advanceActionSchema = z.object({
  action: z.enum([
    "approve",
    "negotiate",
    "reject",
    "process",
    "mark_processed",
    "accept_negotiation",
    "gateway_initiate",
    "gateway_approve_execute",
  ]),
  beneficiaryId: optStr,
  paymentId: optStr,
  amount: optNum,
  negotiatedAmount: optNum,
  remarks: optStr,
});

export const advancePaymentSchema = z.object({
  paidAmount: z.coerce.number().positive("Amount to pay must be greater than zero"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  paymentDate: z.string().min(1, "Payment date is required"),
  utrReference: z.string().min(1, "UTR / transaction reference is required"),
  bankAccountUsed: optStr,
  remarks: optStr,
});

export const balancePaymentActionSchema = z.object({
  action: z.enum(["approve", "process", "record_payment", "gateway_initiate", "gateway_approve_execute"]),
  beneficiaryId: optStr,
  paymentId: optStr,
  paymentMode: optStr,
  paymentDetails: optStr,
  utrReference: optStr,
  chequeNumber: optStr,
  amount: optNum,
  paidAt: optStr,
  remarks: optStr,
});

export const clientPaymentSchema = z.object({
  clientId: z.string().min(1),
  paymentType: z.enum(["ADVANCE", "PAYMENT", "OTHER"]).default("PAYMENT"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paidAt: z.string().min(1, "Payment date is required"),
  paymentMode: optStr,
  referenceNo: optStr,
  chequeNumber: optStr,
  notes: optStr,
  invoiceId: optStr,
  indentId: optStr,
  tripId: optStr,
});

export const tripChargeSchema = z.object({
  chargeType: z.enum(["DETENTION", "DEDUCTION", "OTHER"]),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: optStr,
});

export const clientPaymentUpdateSchema = clientPaymentSchema.partial().extend({
  clientId: optStr,
});

export const vendorPaymentSchema = z.object({
  vendorId: z.string().min(1),
  tripId: z.string().min(1),
  paymentType: z.enum(["ADVANCE", "BALANCE", "OTHER"]).default("BALANCE"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paidAt: z.string().min(1, "Payment date is required"),
  paymentMode: optStr,
  referenceNo: optStr,
  chequeNumber: optStr,
  notes: optStr,
  advanceAmount: optNum,
  tdsAmount: optNum,
});

export const externalAdvanceUpdateSchema = z.object({
  action: z.literal("update_external"),
  requestedAmount: optNum,
  approvedAmount: optNum,
  externalReference: optStr,
  remarks: optStr,
});

export const placementSchema = z.object({
  action: z.enum(["vehicle_reached", "reopen"]),
  remarks: optStr,
});

export const allocationSchema = z
  .object({
    vendorId: optStr,
    quoteId: optStr,
    vendorRate: optNum,
  })
  .refine((d) => d.vendorId || d.quoteId, { message: "vendorId or quoteId is required" });

export const allocationModeSchema = z.object({
  mode: z.enum(["BIDDING", "MANUAL"]),
});

export const reallocationSchema = z.object({
  reason: z.string().trim().min(2, "Reallocation reason is required"),
  vendorId: optStr,
  quoteId: optStr,
  vendorRate: optNum,
});

export const vehicleAssignmentSchema = z.object({
  registrationNumber: vehicleRegSchema,
  vehicleTypeCode: optStr,
  bodyTypeCode: optStr,
  capacityTons: optNum,
  capacityCbm: optNum,
  remarks: optStr,
});

export const indentDriverSchema = z.object({
  name: z.string().trim().min(1, "Driver name is required"),
  dlNumber: z.string().trim().min(4, "DL number is required"),
  phone: requiredPhone(),
  deviceType: z.enum(["SMARTPHONE", "FEATURE_PHONE"]).default("SMARTPHONE"),
  address: optStr,
  city: optStr,
  state: optStr,
  pincode: optionalPincodeSchema,
});

export const driverLoginOtpRequestSchema = z.object({
  dlNumber: z.string().trim().min(4, "DL number is required").transform((v) => v.replace(/\s+/g, "").toUpperCase()),
  phone: requiredPhone(),
});

export const driverOtpSendSchema = z.object({
  phone: requiredPhone(),
});

export const driverOtpVerifySchema = z.object({
  otp: otpSchema,
});

/** Forgot-password: step 1 — request an email OTP. */
export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

/** Forgot-password: step 2 — verify the OTP and set a new password. */
export const forgotPasswordResetSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const podSchema = z.object({
  source: z.enum(["DRIVER", "EMPLOYEE", "VENDOR"]).default("DRIVER"),
  remarks: optStr,
});

export const podReviewSchema = z.object({
  action: z.enum(["verify", "reject"]),
  podId: z.string().min(1),
  rejectionReason: optStr,
});

export const importantEventActionSchema = z.object({
  action: z.enum(["acknowledge", "resolve", "dismiss"]),
  remarks: optStr,
});

export const trackingPingSchema = z.object({
  indentId: optStr,
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  source: z.enum(["GPS", "CELL"]).default("GPS"),
  accuracyMeters: optNum,
  provider: optStr,
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Full name is required"),
    email: emailSchema,
    password: z.string().min(8, "Password must be at least 8 characters"),
    phone: requiredPhone(),
    role: z.enum(["CLIENT", "VENDOR"]),
    companyName: optStr,
  })
  .refine((data) => data.companyName != null && data.companyName.trim().length >= 2, {
    message: "Company / business name is required",
    path: ["companyName"],
  });

export const vendorQuoteSchema = z
  .object({
    action: z.enum(["submit", "accept"]).optional(),
    quoteId: optStr,
    quotedRate: z.coerce.number().positive().optional(),
    vehicleId: optStr,
    remarks: optStr,
  })
  .refine((data) => data.action === "accept" || data.quotedRate != null, {
    message: "quotedRate is required",
    path: ["quotedRate"],
  });

export const onboardingSubmitSchema = z.object({
  remarks: optStr,
});

export const onboardingDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  remarks: optStr,
});

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function formatZodIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((i) => {
      const field = i.path.join(".") || "body";
      return `${field}: ${i.message}`;
    })
    .join("; ");
}

export function zodFieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "body";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

export function validate<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown
): ValidationResult<z.output<S>> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, error: formatZodIssues(result.error.issues) };
  }
  return { success: true, data: result.data };
}
