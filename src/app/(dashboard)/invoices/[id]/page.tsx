import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import InvoiceActions from "@/components/forms/invoice-actions";
import InvoiceDocument from "@/components/invoice-document";
import InvoicePdfDownload from "@/components/invoices/invoice-pdf-download";
import { getInvoiceDetail } from "@/lib/queries";
import {
  buildInvoicePrintHtml,
  loadInvoicePrintSnapshot,
} from "@/lib/services/invoice-document.service";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const inv = await getInvoiceDetail(params.id);
  if (!inv) notFound();
  const snapshot = await loadInvoicePrintSnapshot(params.id);
  if (!snapshot) notFound();
  const printHtml = await buildInvoicePrintHtml(params.id);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Link href="/invoices" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 print:hidden">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      <div className="mb-4 print:hidden flex flex-wrap items-center gap-3">
        <InvoiceActions
          invoiceId={inv.id}
          status={inv.status}
          totalAmount={inv.totalAmount}
          paidAmount={inv.paidAmount}
          clientId={inv.client.id}
        />
        <InvoicePdfDownload invoiceId={inv.id} invoiceNumber={inv.invoiceNumber} />
      </div>

      <InvoiceDocument html={printHtml} snapshot={snapshot} payments={inv.payments} />
    </div>
  );
}
