import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import InvoiceForm from "@/components/forms/invoice-form";
import { getInvoiceDetail } from "@/lib/queries";
import { mapInvoiceDetailToEditFormTrips } from "@/lib/invoice-edit-form";

export const dynamic = "force-dynamic";

export default async function EditDraftInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const inv = await getInvoiceDetail(params.id);
  if (!inv) notFound();
  if (inv.status !== "DRAFT") {
    redirect(`/invoices/${inv.id}`);
  }

  const { billing, trips } = mapInvoiceDetailToEditFormTrips(inv);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Link
        href={`/invoices/${inv.id}`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to preview
      </Link>

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">
          Editing draft {inv.invoiceNumber}
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Changes update this same invoice and regenerate the GST preview. Trip selection stays
          locked — adjust billing and line amounts, then review before sending to the client.
        </p>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Edit draft invoice</h1>
        <p className="text-slate-500">
          Same form as generate — update details, then return to the preview.
        </p>
      </div>

      <InvoiceForm
        mode="edit"
        invoiceId={inv.id}
        invoiceNumber={inv.invoiceNumber}
        trips={trips}
        initialBilling={billing}
      />
    </div>
  );
}
