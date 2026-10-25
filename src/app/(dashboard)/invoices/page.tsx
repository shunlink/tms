import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import DataTable, { type DataColumn } from "@/components/data-table";
import { getInvoices } from "@/lib/queries";
import { listInvoiceTasks } from "@/lib/services/invoice-task.service";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusTones: Record<string, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  DRAFT: "muted",
  UNPAID: "warning",
  SENT: "info",
  PAID: "success",
  PARTIALLY_PAID: "warning",
  OVERDUE: "danger",
  CANCELLED: "danger",
};

const columns: DataColumn[] = [
  { key: "invoiceNumber", header: "Invoice No.", kind: "link", hrefPrefix: "/invoices/" },
  { key: "client", header: "Client" },
  { key: "trips", header: "Trips", align: "right" },
  { key: "subTotal", header: "Freight", align: "right", kind: "money" },
  { key: "gstAmount", header: "GST", align: "right", kind: "money" },
  { key: "totalAmount", header: "Total", align: "right", kind: "money" },
  { key: "dueDate", header: "Due Date", kind: "date" },
  { key: "status", header: "Status", kind: "badge", tones: statusTones },
];

export default async function InvoicesPage() {
  const [invoices, pendingTasks] = await Promise.all([getInvoices(), listInvoiceTasks()]);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Client billing and collections"
        action={
          <Link href="/invoices/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Invoice
            </Button>
          </Link>
        }
      />

      {pendingTasks.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle>Pending Invoice Tasks ({pendingTasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-4">
              POD verified — invoice not yet completed. 24-hour SLA from verification.
            </p>
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between border rounded-md p-3"
                >
                  <div>
                    <Link
                      href={`/trips/${task.tripId}`}
                      className="font-medium text-sm text-blue-600 hover:underline"
                    >
                      {task.trip?.lrNumber}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {task.client?.name}
                      {task.trip?.route ? ` · ${task.trip.route}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      POD verified {new Date(task.podVerifiedAt).toLocaleString()}
                      · Due {new Date(task.deadlineAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <StatusBadge status={task.slaBreached ? "SLA_BREACHED" : "PENDING"} />
                    {task.trip?.billableTotal != null && (
                      <p className="text-sm font-medium">{formatINR(task.trip.billableTotal)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={invoices as unknown as Record<string, unknown>[]}
            columns={columns}
            searchKeys={["invoiceNumber", "client", "status"]}
            exportName="invoices"
            emptyText="No invoices yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
