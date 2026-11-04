import { prisma } from "../prisma";
import { juspayRequest } from "./juspay/client";
import { beneficiaryRefFromInternalId } from "./juspay/order-id";
import { juspayConfigured } from "./juspay/config";

type BeneValidateResponse = {
  status?: string;
  uniqueId?: string;
  responseMessage?: string;
};

export async function syncVendorBeneficiaryWithJuspay(beneficiaryId: string) {
  if (!juspayConfigured()) return null;

  const row = await prisma.vendorBeneficiary.findUnique({
    where: { id: beneficiaryId },
    include: { vendor: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!row?.vendor) return null;

  const beneId = row.providerBeneficiaryRef ?? beneficiaryRefFromInternalId(row.id);
  const customerEmail = row.vendor.email?.trim() || "vendor@tms.local";
  const customerPhone = row.vendor.phone?.replace(/\D/g, "").slice(-10) || "9999999999";

  type BeneDetails =
    | { type: "ACCOUNT_IFSC"; details: { name: string; account: string; ifsc: string } }
    | { type: "UPI_ID"; details: { name: string; vpa: string } };

  let beneDetails: BeneDetails;
  if (row.method === "UPI" && row.upiId) {
    beneDetails = {
      type: "UPI_ID",
      details: { name: row.accountHolder ?? row.vendor.name, vpa: row.upiId },
    };
  } else if (row.accountNumber && row.ifsc) {
    beneDetails = {
      type: "ACCOUNT_IFSC",
      details: {
        name: row.accountHolder ?? row.vendor.name,
        account: row.accountNumber,
        ifsc: row.ifsc,
      },
    };
  } else {
    throw new Error("Beneficiary missing bank or UPI details for Juspay validation");
  }

  const command = row.providerBeneficiaryRef ? "VALIDATE" : "CREATE";
  const result = await juspayRequest<BeneValidateResponse>({
    method: "POST",
    path: "/payout/merchant/v2/benedetails",
    routingId: row.vendorId,
    body: {
      beneId,
      beneDetails,
      command,
      customerId: row.vendorId,
      email: customerEmail,
      phone: customerPhone,
    },
  });

  await prisma.vendorBeneficiary.update({
    where: { id: row.id },
    data: {
      providerBeneficiaryRef: beneId,
      juspayValidationStatus: result.status ?? "PENDING",
    },
  });

  return result;
}

export async function refreshJuspayBeneficiaryStatus(beneficiaryId: string) {
  if (!juspayConfigured()) return null;
  const row = await prisma.vendorBeneficiary.findUnique({ where: { id: beneficiaryId } });
  if (!row?.providerBeneficiaryRef) return null;

  const result = await juspayRequest<BeneValidateResponse>({
    method: "GET",
    path: `/payout/merchant/v2/benedetails/${encodeURIComponent(row.vendorId)}/${encodeURIComponent(row.providerBeneficiaryRef)}`,
    routingId: row.vendorId,
  });

  await prisma.vendorBeneficiary.update({
    where: { id: row.id },
    data: { juspayValidationStatus: result.status ?? row.juspayValidationStatus },
  });

  return result;
}
