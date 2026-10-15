import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
  if (!user?.clientId) redirect("/login");

  const inv = await getInvoiceDetail(params.id);
  if (!inv || inv.client.id !== user.clientId || CLIENT_HIDDEN_INVOICE_STATUSES.includes(inv.status)) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/portal/client/invoices" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 print:hidden">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>
      <div className="mb-4 print:hidden">
        <PrintButton />
      </div>
      <InvoiceDocument inv={inv} />
    </div>
  );
}
