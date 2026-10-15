import { z } from "zod";

const addressSchema = z.object({
  line1: z.string().optional().nullable(),
  line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
});

const bankSchema = z
  .object({
    accountHolder: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    accountNumber: z.string().optional().nullable(),
    ifsc: z.string().optional().nullable(),
    branch: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),
  })
  .optional()
  .nullable();

const onboardingDocumentSchema = z
  .object({
    documentType: z.string(),
    fileName: z.string(),
    /** Absolute URL or path relative to `BIDDING_SERVICE_URL`. */
    downloadUrl: z.string().optional().nullable(),
    /** Bidding document id — fetched from `/api/internal/tms-admin/documents/{id}/preview`. */
    documentId: z.string().optional().nullable(),
    mimeType: z.string().optional().nullable(),
  })
  .refine((d) => Boolean(d.downloadUrl?.trim() || d.documentId?.trim()), {
    message: "Each document requires downloadUrl or documentId",
  });

/** Bidding → TMS onboarding handoff (queue or auto-approve). */
export const onboardingSyncSchema = z.object({
  idempotencyKey: z.string().min(1),
  partyType: z.enum(["CLIENT", "VENDOR"]),
  biddingCompanyId: z.string().min(1),
  biddingApplicationId: z.string().min(1),
  /** SUBMITTED = enter TMS approval queue; APPROVED = legacy auto-approve. */
  status: z.enum(["SUBMITTED", "APPROVED"]).optional().default("APPROVED"),
  approvedAt: z.string().optional().nullable(),
  /** Free-text note from Bidding (e.g. onboarding context); stored on Client/Vendor when provided. */
  remarks: z.string().optional().nullable(),
  snapshot: z.object({
    legalName: z.string().optional().nullable(),
    tradeName: z.string().optional().nullable(),
    gstin: z.string().optional().nullable(),
    pan: z.string().optional().nullable(),
    cin: z.string().optional().nullable(),
    msme: z.string().optional().nullable(),
    contactName: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    whatsapp: z.string().optional().nullable(),
    registeredAddress: addressSchema.optional().nullable(),
    bank: bankSchema,
    documents: z.array(onboardingDocumentSchema).optional().default([]),
    vendorType: z.enum(["FLEET_OWNER", "BROKER"]).optional().nullable(),
    remarks: z.string().optional().nullable(),
  }),
  actor: z
    .object({
      tmsUserId: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

/** @deprecated Use onboardingSyncSchema — kept as alias for existing imports. */
export const onboardingApprovedSchema = onboardingSyncSchema;

export type OnboardingSyncPayload = z.infer<typeof onboardingSyncSchema>;
export type OnboardingApprovedPayload = OnboardingSyncPayload;

export const verifyCredentialsSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export type VerifyCredentialsPayload = z.infer<typeof verifyCredentialsSchema>;

const lanePointSchema = z.object({
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  partyName: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
});

export const awardHandoffSchema = z.object({
  idempotencyKey: z.string().min(1),
  loadRequirementId: z.string().min(1),
  bidId: z.string().min(1),
  bidAcceptanceId: z.string().optional().nullable(),
  clientBiddingCompanyId: z.string().min(1),
  vendorBiddingCompanyId: z.string().min(1),
  clientPriceInr: z.number().positive(),
  vendorPriceInr: z.number().positive(),
  lane: z.object({
    from: lanePointSchema,
    to: lanePointSchema,
  }),
  cargo: z.object({
    materialDescription: z.string().optional().nullable(),
    /** TMS code (e.g. TRUCK_32FT_MULTI) or Bidding category (e.g. OPEN_BODY). */
    vehicleTypeCode: z.string().optional().nullable(),
    /** Bidding category when not using a TMS vehicleTypeCode. */
    vehicleCategory: z
      .enum(["OPEN_BODY", "CONTAINER", "TRAILER", "TANKER", "REFRIGERATED", "OTHER"])
      .optional()
      .nullable(),
    bodyTypeCode: z.string().optional().nullable(),
    weightValue: z.number().optional().nullable(),
    weightUnit: z.string().optional().default("MT"),
    packageCount: z.number().int().optional().nullable(),
    reportingAt: z.string().optional().nullable(),
    cargoTypeCode: z.string().optional().default("GENERAL"),
  }),
  placement: z
    .object({
      vehicleRegistration: z.string().optional().nullable(),
      driver: z
        .object({
          name: z.string().optional().nullable(),
          phone: z.string().optional().nullable(),
          dlNumber: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
    })
    .optional()
    .default({ vehicleRegistration: null, driver: null }),
  externalRefs: z.record(z.string()).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export type AwardHandoffPayload = z.infer<typeof awardHandoffSchema>;

export const biddingCompanyIdQuerySchema = z.object({
  biddingCompanyId: z.string().min(1),
});

export const vendorTripsQuerySchema = biddingCompanyIdQuerySchema.extend({
  status: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});
