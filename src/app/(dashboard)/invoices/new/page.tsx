import InvoiceForm from "@/components/forms/invoice-form";
import { getBillableTrips } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const trips = await getBillableTrips();
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Create Invoice</h1>
        <p className="text-slate-500">Select POD-verified trips to bill the client (24h SLA from verification)</p>
      </div>
      <InvoiceForm trips={trips} />
    </div>
  );
}
