import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdvancePaymentVoucherDocument from "@/components/advance-payment-voucher-document";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/company";
import { getAdvanceVoucherForRequest } from "@/lib/services/advance-voucher.service";

export const dynamic = "force-dynamic";

export default async function VendorAdvanceVoucherPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const owned = await prisma.advanceRequest.findFirst({
    where: { id: params.id, vendorId: user.vendorId, status: "PROCESSED" },
    select: { id: true },
  });
  if (!owned) notFound();

  const [voucher, company] = await Promise.all([
    getAdvanceVoucherForRequest(params.id),
    getCompanyProfile(),
  ]);
  if (!voucher?.voucherData) notFound();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Link
        href="/portal/vendor/payments"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Payments
      </Link>
      <AdvancePaymentVoucherDocument
        data={voucher.voucherData}
        company={company}
        paymentProofUrl={null}
      />
    </div>
  );
}
