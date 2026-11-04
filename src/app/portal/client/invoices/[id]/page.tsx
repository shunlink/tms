import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import InvoiceDocument from "@/components/invoice-document";
import InvoicePdfDownload from "@/components/invoices/invoice-pdf-download";
import PrintButton from "@/components/print-button";
import {
  buildInvoicePrintHtml,
  loadInvoicePrintSnapshot,
} from "@/lib/services/invoice-document.service";
import { getSessionUser } from "@/lib/auth";
import { getInvoiceDetail } from "@/lib/queries";
import { CLIENT_HIDDEN_INVOICE_STATUSES } from "@/lib/client-trip-sync";
import { invoiceOutstanding } from "@/lib/invoice-payment";
import ClientPortalPayButton from "@/components/portal/client-portal-pay-button";
import { hypercheckoutEnabled } from "@/lib/payments/inbound/hypercheckout.service";
import { juspayMaxCheckoutRupees } from "@/lib/payments/juspay/config";
import { canClientPerformPortalMutations } from "@/lib/portal-access";
import { getOnboardingStatus } from "@/lib/services/onboarding.service";

export const dynamic = "force-dynamic";

export default async function ClientInvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  const inv = await getInvoiceDetail(params.id);
  if (!inv || inv.client.id !== user.clientId || CLIENT_HIDDEN_INVOICE_STATUSES.includes(inv.status)) {
    notFound();
  }
  const snapshot = await loadInvoicePrintSnapshot(params.id);
  if (!snapshot) notFound();
  const printHtml = await buildInvoicePrintHtml(params.id);
  const outstanding = invoiceOutstanding(Number(inv.totalAmount), Number(inv.paidAmount));
  const checkoutCap = juspayMaxCheckoutRupees();
  const maxPayAmount =
    checkoutCap != null ? Math.min(outstanding, checkoutCap) : outstanding;
  const onboardingStatus = await getOnboardingStatus("CLIENT", user.clientId);
  const canPay =
    hypercheckoutEnabled() &&
    canClientPerformPortalMutations(onboardingStatus) &&
    outstanding > 0 &&
    !["PAID", "DRAFT", "CANCELLED"].includes(inv.status);

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <Link
            href="/portal/client/invoices"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-950 mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Invoices</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
            Invoice {inv.invoiceNumber}
          </h1>
        </div>

        <div className="print:hidden flex flex-wrap gap-2">
          {canPay ? (
            <ClientPortalPayButton
              purpose="INVOICE"
              invoiceId={inv.id}
              outstanding={outstanding}
              maxPayAmount={maxPayAmount}
              checkoutCapRupees={checkoutCap}
            />
          ) : null}
          <InvoicePdfDownload invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />
          <PrintButton />
        </div>
      </div>

      {/* Invoice Document Wrapper */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-8 shadow-2xs">
        <InvoiceDocument html={printHtml} snapshot={snapshot} payments={inv.payments} />
      </div>
    </div>
  );
}
