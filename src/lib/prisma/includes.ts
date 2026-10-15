import { tripAdvanceSummarySelect } from "../advance";

export const indentFullInclude = {
  client: { select: { id: true, name: true, gstin: true, phone: true } },
  requirement: { select: { id: true, reqNumber: true } },
  consignment: true,
  ewayBill: true,
  loading: true,
  unloading: true,
  cargo: true,
  clientFreight: true,
  vendor: {
    select: { id: true, name: true, phone: true, whatsapp: true, contactName: true, rating: true },
  },
  vehicle: { select: { id: true, registrationNumber: true, vehicleTypeCode: true, bodyTypeCode: true } },
  driver: {
    select: {
      id: true,
      name: true,
      phone: true,
      dlNumber: true,
      deviceType: true,
      otpVerified: true,
      accountStatus: true,
    },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    include: { recordedBy: { select: { id: true, name: true } } },
  },
  releaseCities: { orderBy: { releasedAt: "asc" as const }, select: { city: true } },
  lines: {
    orderBy: { lineNumber: "asc" as const },
    include: {
      allocations: {
        orderBy: { allocatedAt: "desc" as const },
        include: {
          vendor: { select: { id: true, name: true, phone: true } },
          vehicle: { select: { id: true, registrationNumber: true } },
          driver: { select: { id: true, name: true, phone: true, dlNumber: true } },
          allocatedBy: { select: { id: true, name: true, email: true } },
        },
      },
      trip: { select: { id: true, lrNumber: true } },
    },
  },
  trips: {
    select: {
      id: true,
      lrNumber: true,
      status: true,
      advanceRequests: { select: tripAdvanceSummarySelect },
      balancePaymentTask: {
        select: { status: true, finalPayableAmount: true, balanceAmount: true, paidAmount: true },
      },
    },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
  quotes: {
    orderBy: { quotedRate: "asc" as const },
    include: {
      vendor: { select: { id: true, name: true, phone: true, rating: true } },
      vehicle: { select: { id: true, registrationNumber: true, vehicleTypeCode: true } },
    },
  },
  pods: {
    orderBy: { uploadedAt: "desc" as const },
    include: {
      file: true,
      backFile: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      verifiedBy: { select: { id: true, name: true } },
      rejectedBy: { select: { id: true, name: true } },
      previousPod: {
        include: { file: true, backFile: true, rejectedBy: { select: { id: true, name: true } } },
      },
    },
  },
  importantEvents: { orderBy: { createdAt: "desc" as const } },
  trackingPings: { orderBy: { recordedAt: "desc" as const }, take: 1 },
};
