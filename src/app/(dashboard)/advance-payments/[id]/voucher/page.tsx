import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdvancePaymentVoucherDocument from "@/components/advance-payment-voucher-document";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/services/permission.service";
import { getAdvanceVoucherForRequest } from "@/lib/services/advance-voucher.service";

export const dynamic = "force-dynamic";

export default async function AdvanceVoucherPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") {
    const allowed = await hasPermission(user.id!, "advance.view");
    if (!allowed) redirect("/");
  }

  const voucher = await getAdvanceVoucherForRequest(params.id);
  if (!voucher?.voucherData) notFound();

  return (
    <div className="max-w-4xl">
      <Link
        href="/advance-payments"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Advance Payments
      </Link>
      <AdvancePaymentVoucherDocument
        data={voucher.voucherData}
        paymentProofUrl={voucher.paymentProofUrl}
      />
    </div>
  );
}
