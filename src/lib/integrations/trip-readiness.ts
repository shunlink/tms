import "server-only";

import { prisma } from "@/lib/prisma";
import { isEwayBillExpired } from "./ewaybill/normalize";
import { documentValidity } from "./vehicle/compliance";

export type TripReadinessResult = {
  ready: boolean;
  reasons: string[];
};

function hasValue(v: string | null | undefined) {
  return Boolean(v && v.trim());
}

export async function checkIndentTripReadiness(indentId: string): Promise<TripReadinessResult> {
  const reasons: string[] = [];

  const indent = await prisma.indent.findFirst({
    where: { id: indentId },
    include: {
      consignment: { select: { ewayBillRequired: true } },
      ewayBill: true,
      vehicle: { include: { compliance: true } },
      driver: true,
    },
  });

  if (!indent) {
    return { ready: false, reasons: ["Indent not found"] };
  }

  if (indent.consignment?.ewayBillRequired) {
    const ewb = indent.ewayBill;
    if (!ewb || ewb.mode === "NONE") {
      reasons.push("E-Way Bill information is required but not provided");
    } else {
      if (!hasValue(ewb.ewayBillNumber) && ewb.mode === "EXISTING") {
        reasons.push("E-Way Bill number is missing");
      }
      if (!hasValue(ewb.supplierGstin)) reasons.push("E-Way Bill supplier GSTIN is incomplete");
      if (!hasValue(ewb.recipientGstin)) reasons.push("E-Way Bill recipient GSTIN is incomplete");
      if (!hasValue(ewb.goodsDescription)) reasons.push("E-Way Bill goods description is incomplete");
      if (
        isEwayBillExpired({
          status: ewb.status,
          validUntil: ewb.validUntil?.toISOString() ?? null,
        })
      ) {
        reasons.push("E-Way Bill is expired or invalid");
      }
    }
  }

  const compliance = indent.vehicle?.compliance;
  if (!indent.vehicleId || !compliance) {
    reasons.push("Vehicle must be assigned");
  } else if (!compliance.rcVerified) {
    reasons.push("Vehicle RC verification missing");
  } else {
    const rc = documentValidity(compliance.rcExpiry?.toISOString() ?? null);
    const insurance = documentValidity(compliance.insuranceExpiry?.toISOString() ?? null);
    const puc = documentValidity(compliance.pucExpiry?.toISOString() ?? null);
    const fitness = documentValidity(compliance.fitnessExpiry?.toISOString() ?? null);
    if (rc === "EXPIRED") reasons.push("Vehicle RC expired");
    if (insurance === "EXPIRED") reasons.push("Vehicle insurance expired");
    if (puc === "EXPIRED") reasons.push("Vehicle PUC expired");
    if (fitness === "EXPIRED") reasons.push("Vehicle fitness certificate expired");
    if (
      compliance.complianceState === "NON_COMPLIANT" &&
      !reasons.some((r) => r.startsWith("Vehicle"))
    ) {
      reasons.push("Vehicle compliance documents are not valid");
    }
  }

  const driver = indent.driver;
  if (!driver) {
    reasons.push("Driver must be assigned");
  } else {
    if (!driver.dlVerified) {
      reasons.push("DL verification missing");
    }
    if (!driver.otpVerified) {
      reasons.push("Driver OTP verification must be completed");
    }
    const status = (driver.dlStatus ?? driver.dlVerificationStatus ?? "").toLowerCase();
    if (status.includes("suspend") || status.includes("expired") || status.includes("invalid")) {
      reasons.push("Driving licence is not valid");
    }
  }

  return { ready: reasons.length === 0, reasons };
}
