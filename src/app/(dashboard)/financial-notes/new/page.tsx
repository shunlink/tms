import PageHeader from "@/components/page-header";
import NewFinancialNoteForm from "@/components/financial-notes/new-financial-note-form";
import { requirePagePermission } from "@/lib/page-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewFinancialNotePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requirePagePermission("financial_note.create");

  const sp = searchParams ?? {};
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const prefill = {
    vendorId: one("vendorId"),
    tripId: one("tripId"),
    indentPodId: one("indentPodId"),
    indentId: one("indentId"),
    purpose: one("purpose"),
    noteType: one("noteType") as "DEBIT_NOTE" | "CREDIT_NOTE" | undefined,
  };

  const [vendors, clients, trips, invoices] = await Promise.all([
    prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      take: 400,
      select: {
        id: true,
        lrNumber: true,
        vendorId: true,
        clientId: true,
        routeFrom: true,
        routeTo: true,
      },
    }),
    prisma.clientInvoice.findMany({
      where: { status: { notIn: ["CANCELLED", "DRAFT"] } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        invoiceNumber: true,
        clientId: true,
        totalAmount: true,
        status: true,
      },
    }),
  ]);

  return (
    <div>
      <PageHeader title="New debit / credit note" description="Draft only — issue after approval" />
      <NewFinancialNoteForm
        prefill={prefill}
        options={{
          vendors,
          clients,
          trips: trips.map((t) => ({
            id: t.id,
            lrNumber: t.lrNumber,
            vendorId: t.vendorId,
            clientId: t.clientId,
            route: `${t.routeFrom} → ${t.routeTo}`,
          })),
          invoices: invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            clientId: inv.clientId,
            totalAmount: Number(inv.totalAmount),
            status: inv.status,
          })),
        }}
      />
    </div>
  );
}
