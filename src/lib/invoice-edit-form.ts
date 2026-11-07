import type { getInvoiceDetail } from "./queries";

type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;

export type InvoiceEditLineDefaults = {
  id?: string;
  tripId: string;
  lineKind?: "FREIGHT" | "LOADING" | "UNLOADING";
  amount: number;
  gstRate: number;
  gstAmount: number;
  description: string | null;
  lrNumber: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  cargoSummary: string | null;
  vehicleReg: string | null;
  indentNumber: string | null;
};

export type InvoiceEditBilling = {
  billingName: string | null;
  billingGstin: string | null;
  billingAddress: string | null;
  billingEmail: string | null;
  paymentTermsDays: number | null;
};

export type InvoiceEditBillableTrip = {
  id: string;
  indentId: string | null;
  lrNumber: string;
  clientId: string;
  client: string;
  route: string;
  clientRate: number;
  podVerifiedAt: string | Date | null;
  invoiceTask: null;
  billing: InvoiceEditBilling;
  line: InvoiceEditLineDefaults;
  lines: InvoiceEditLineDefaults[];
};

function normalizeLineKind(kind: string | null | undefined): "FREIGHT" | "LOADING" | "UNLOADING" {
  if (kind === "LOADING" || kind === "UNLOADING") return kind;
  return "FREIGHT";
}

/** Map a draft invoice detail into InvoiceForm trip props (trips locked/selected). */
export function mapInvoiceDetailToEditFormTrips(inv: InvoiceDetail): {
  billing: InvoiceEditBilling;
  trips: InvoiceEditBillableTrip[];
} {
  const billing: InvoiceEditBilling = {
    billingName: inv.billingName ?? inv.client.name,
    billingGstin: inv.billingGstin ?? inv.client.gstin,
    billingAddress: inv.billingAddress ?? inv.client.address,
    billingEmail: inv.billingEmail ?? inv.client.email,
    paymentTermsDays: inv.paymentTermsDays,
  };

  const byTrip = new Map<string, InvoiceEditLineDefaults[]>();
  const tripMeta = new Map<
    string,
    { lrNumber: string; route: string; indentNumber: string | null }
  >();

  for (const row of inv.trips) {
    const lineKind = normalizeLineKind(row.lineKind);
    const amount = row.clientRate;
    const gstRate = row.gstRate ?? 0.18;
    const gstAmount = row.gstAmount ?? Math.round(amount * gstRate * 100) / 100;
    const line: InvoiceEditLineDefaults = {
      id: row.id,
      tripId: row.tripId,
      lineKind,
      amount,
      gstRate,
      gstAmount,
      description: row.description,
      lrNumber: row.lrNumber,
      routeFrom: row.routeFrom ?? null,
      routeTo: row.routeTo ?? null,
      cargoSummary: row.cargoSummary,
      vehicleReg: row.vehicleReg,
      indentNumber: row.indentNumber,
    };
    const list = byTrip.get(row.tripId) ?? [];
    list.push(line);
    byTrip.set(row.tripId, list);
    if (!tripMeta.has(row.tripId)) {
      tripMeta.set(row.tripId, {
        lrNumber: row.lrNumber,
        route: row.route,
        indentNumber: row.indentNumber,
      });
    }
  }

  const trips: InvoiceEditBillableTrip[] = Array.from(byTrip.entries()).map(([tripId, lines]) => {
    const meta = tripMeta.get(tripId)!;
    const freight = lines.find((l) => (l.lineKind ?? "FREIGHT") === "FREIGHT") ?? lines[0];
    return {
      id: tripId,
      indentId: null,
      lrNumber: meta.lrNumber,
      clientId: inv.client.id,
      client: inv.client.name,
      route: meta.route,
      clientRate: lines.reduce((s, l) => s + l.amount, 0),
      podVerifiedAt: null,
      invoiceTask: null,
      billing,
      line: freight,
      lines,
    };
  });

  return { billing, trips };
}
