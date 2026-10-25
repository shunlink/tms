import InvoiceForm from "@/components/forms/invoice-form";
import { getBillableTrips } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams?: { indentId?: string };
}) {
  const trips = await getBillableTrips();
  const preselectIndentId = searchParams?.indentId?.trim() || null;
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Create Invoice</h1>
        <p className="text-slate-500">Select POD-verified trips to bill the client (24h SLA from verification)</p>
      </div>
      <InvoiceForm trips={trips} preselectIndentId={preselectIndentId} />
    </div>
  );
}
