import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import InvoiceActions from "@/components/forms/invoice-actions";
import InvoiceDocument from "@/components/invoice-document";
import { getInvoiceDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const inv = await getInvoiceDetail(params.id);
  if (!inv) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/invoices" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 print:hidden">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      <div className="mb-4 print:hidden">
        <InvoiceActions
          invoiceId={inv.id}
          status={inv.status}
          totalAmount={inv.totalAmount}
          paidAmount={inv.paidAmount}
          clientId={inv.client.id}
        />
      </div>

      <InvoiceDocument inv={inv} />
    </div>
  );
}
