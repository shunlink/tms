import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import InvoiceDocument from "@/components/invoice-document";
import PrintButton from "@/components/print-button";
import { getSessionUser } from "@/lib/auth";
import { getInvoiceDetail } from "@/lib/queries";
import { CLIENT_HIDDEN_INVOICE_STATUSES } from "@/lib/client-trip-sync";

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

  return (
    <div className="space-y-6 max-w-5xl">
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

        <div className="print:hidden">
          <PrintButton />
        </div>
      </div>

      {/* Invoice Document Wrapper */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-8 shadow-2xs">
        <InvoiceDocument inv={inv} />
      </div>
    </div>
  );
}
