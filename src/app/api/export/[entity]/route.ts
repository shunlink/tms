import { prisma } from "@/lib/prisma";
import { requireAuth, authorize, notFound, serverError } from "@/lib/api";
import type { PermissionKey } from "@/lib/permissions";
import { csvEscape } from "@/lib/logic";
import { resolveTripVendorAdvance, tripAdvanceSummarySelect } from "@/lib/advance";

type Row = Record<string, unknown>;

function toCsv(rows: Row[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ].join("\n");
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");

const EXPORT_PERMISSIONS: Record<string, PermissionKey> = {
  clients: "client.view",
  vendors: "vendor.view",
  trips: "trip.view",
  invoices: "invoice.view",
  payments: "payment.view",
  indents: "indent.view",
  requirements: "requirement.view",
};

export async function GET(_req: Request, { params }: { params: { entity: string } }) {
  const auth = await requireAuth();
  const permission = EXPORT_PERMISSIONS[params.entity] ?? "reports.view";
  const denied = await authorize(auth, permission);
  if (denied) return denied;
  try {
    let rows: Row[] = [];

    switch (params.entity) {
      case "clients": {
        const data = await prisma.client.findMany({ orderBy: { createdAt: "desc" }, include: { commercial: true } });
        rows = data.map((c) => ({
          name: c.name,
          contactName: c.contactName,
          phone: c.phone,
          email: c.email,
          gstin: c.gstin,
          paymentTerms: c.commercial?.paymentTermsDays ?? "",
          creditLimit: c.commercial?.creditLimit?.toString() ?? "",
        }));
        break;
      }
      case "vendors": {
        const data = await prisma.vendor.findMany({ orderBy: { createdAt: "desc" }, include: { commercial: { include: { bankAccount: true } } } });
        rows = data.map((v) => ({
          name: v.name,
          type: v.type,
          phone: v.phone,
          gstin: v.gstin,
          bankName: v.commercial?.bankAccount?.bankName ?? "",
          bankAccount: v.commercial?.bankAccount?.accountNumber ?? "",
          rating: v.rating?.toString() ?? "",
        }));
        break;
      }
      case "vehicles": {
        const data = await prisma.vehicle.findMany({ include: { vendor: { select: { name: true } }, compliance: true } });
        rows = data.map((v) => ({
          registrationNumber: v.registrationNumber,
          vehicleTypeCode: v.vehicleTypeCode,
          capacityTons: v.capacityTons?.toString() ?? "",
          owner: v.vendor?.name ?? "",
          insuranceExpiry: iso(v.compliance?.insuranceExpiry),
          fitnessExpiry: iso(v.compliance?.fitnessExpiry),
          pucExpiry: iso(v.compliance?.pucExpiry),
        }));
        break;
      }
      case "drivers": {
        const data = await prisma.driver.findMany({ orderBy: { createdAt: "desc" } });
        rows = data.map((d) => ({
          name: d.name,
          phone: d.phone,
          dlNumber: d.dlNumber,
          dlExpiry: iso(d.dlExpiry),
          deviceType: d.deviceType,
          otpVerified: d.otpVerified,
        }));
        break;
      }
      case "trips": {
        const data = await prisma.trip.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            client: { select: { name: true } },
            vendor: { select: { name: true } },
            vehicle: { select: { registrationNumber: true } },
          },
        });
        rows = data.map((t) => ({
          lrNumber: t.lrNumber,
          routeFrom: t.routeFrom,
          routeTo: t.routeTo,
          client: t.client.name,
          vendor: t.vendor.name,
          vehicle: t.vehicle.registrationNumber,
          clientRate: t.clientRate.toString(),
          vendorRate: t.vendorRate.toString(),
          margin: t.margin.toString(),
          status: t.status,
          createdAt: iso(t.createdAt),
        }));
        break;
      }
      case "invoices": {
        const data = await prisma.clientInvoice.findMany({ orderBy: { createdAt: "desc" }, include: { client: { select: { name: true } } } });
        rows = data.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          client: i.client.name,
          subTotal: i.subTotal.toString(),
          gstAmount: i.gstAmount.toString(),
          totalAmount: i.totalAmount.toString(),
          paidAmount: i.paidAmount.toString(),
          status: i.status,
          issueDate: iso(i.issueDate),
          dueDate: iso(i.dueDate),
        }));
        break;
      }
      case "payments": {
        const data = await prisma.vendorPayment.findMany({ orderBy: { createdAt: "desc" }, include: { vendor: { select: { name: true } }, trip: { select: { lrNumber: true } } } });
        rows = data.map((p) => ({
          vendor: p.vendor.name,
          lrNumber: p.trip.lrNumber,
          amount: p.amount.toString(),
          advanceAmount: p.advanceAmount.toString(),
          tdsAmount: p.tdsAmount.toString(),
          netPayable: p.netPayable.toString(),
          status: p.status,
        }));
        break;
      }
      case "indents": {
        const data = await prisma.indent.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            client: { select: { name: true } },
            vendor: { select: { name: true } },
            vehicle: { select: { registrationNumber: true } },
            loading: { select: { city: true } },
            unloading: { select: { city: true } },
            consignment: { select: { vehicleTypeCode: true, vehicleQuantity: true, weightValue: true } },
            cargo: { select: { description: true } },
            clientFreight: { select: { clientRate: true, freightType: true } },
            trips: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { advanceRequests: { select: tripAdvanceSummarySelect } },
            },
          },
        });
        rows = data.map((i) => {
          const tripAdvance = resolveTripVendorAdvance(i.trips[0]?.advanceRequests);
          return {
          indentNumber: i.indentNumber,
          client: i.client.name,
          consignorCity: i.loading?.city ?? "",
          consigneeCity: i.unloading?.city ?? "",
          vehicleType: i.consignment?.vehicleTypeCode ?? "",
          quantity: i.consignment?.vehicleQuantity ?? "",
          material: i.cargo?.description ?? "",
          clientRate: i.clientFreight?.clientRate?.toString() ?? "",
          vendor: i.vendor?.name ?? "",
          vehicle: i.vehicle?.registrationNumber ?? "",
          advanceStatus: tripAdvance?.status ?? i.advanceStatus,
          advancePaid: tripAdvance?.paidAmount ?? "",
          placementStatus: i.placementStatus,
          status: i.status,
          };
        });
        break;
      }
      default:
        return notFound("Unknown export entity");
    }

    const csv = toCsv(rows);
    return new Response(csv || "no data", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${params.entity}.csv"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
