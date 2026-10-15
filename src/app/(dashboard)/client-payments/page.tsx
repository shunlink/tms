import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import DataTable, { type DataColumn } from "@/components/data-table";
import ClientPaymentForm from "@/components/forms/client-payment-form";
import { requirePagePermission } from "@/lib/page-auth";
import { listClientPayments, countClientPaymentsThisMonth } from "@/lib/services/client-payment.service";
import { getFormOptions } from "@/lib/queries";
import { hasPermission } from "@/lib/services/permission.service";
import { formatINR, formatDate } from "@/lib/utils";
import { IndianRupee, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

const columns: DataColumn[] = [
  { key: "paidAtDisplay", header: "Date" },
  { key: "clientName", header: "Client" },
  { key: "paymentType", header: "Type" },
  { key: "amountDisplay", header: "Amount", align: "right" },
  { key: "referenceNo", header: "Reference" },
  { key: "invoiceNumber", header: "Invoice", kind: "link", hrefPrefix: "/invoices/", idKey: "invoiceId" },
  { key: "recordedBy", header: "Recorded By" },
  { key: "proofLabel", header: "Proof", kind: "external-link", hrefKey: "proofUrl" },
];

type SearchParams = {
  clientId?: string;
  invoiceId?: string;
};

export default async function ClientPaymentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const user = await requirePagePermission("invoice.view");
  const canManage = user.role === "SUPER_ADMIN" || (user.id ? await hasPermission(user.id, "client.payment.manage") : false);

  const [payments, monthStats, formOptions] = await Promise.all([
    listClientPayments({
      clientId: searchParams?.clientId,
      invoiceId: searchParams?.invoiceId,
    }),
    countClientPaymentsThisMonth(),
    getFormOptions(),
  ]);

  const rows = payments.map((p) => ({
    ...p,
    clientName: p.client.name,
    paidAtDisplay: formatDate(p.paidAt),
    amountDisplay: formatINR(p.amount),
    invoiceId: p.invoiceId ?? "",
    invoiceNumber: p.invoice?.invoiceNumber ?? "—",
    recordedBy: p.recordedBy?.name ?? "—",
    referenceNo: p.referenceNo ?? "—",
    proofUrl: p.proof?.url ?? null,
    proofLabel: p.proof?.url ? "View" : "—",
  }));

  const { prisma } = await import("@/lib/prisma");
  const invoiceClientRows = await prisma.clientInvoice.findMany({
    select: { id: true, clientId: true, invoiceNumber: true, totalAmount: true, paidAmount: true },
  });
  const invoicesWithClient = invoiceClientRows.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId,
    totalAmount: Number(i.totalAmount),
    paidAmount: Number(i.paidAmount),
  }));

  return (
    <div>
      <PageHeader
        title="Client Payments"
        description="Record advances and payments received from clients"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard icon={Receipt} value={String(monthStats.count)} label="Payments This Month" />
        <StatCard icon={IndianRupee} value={formatINR(monthStats.total)} label="Received This Month" />
      </div>

      {canManage && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="text-sm text-slate-500">Loading form...</p>}>
              <ClientPaymentForm
                clients={formOptions.clients.map((c) => ({ id: c.id, label: c.name }))}
                invoices={invoicesWithClient}
              />
            </Suspense>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment Records ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={rows as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["clientName", "referenceNo", "paymentType", "invoiceNumber"]}
            exportName="client-payments"
            emptyText="No client payments recorded yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
