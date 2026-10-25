import { prisma } from "./prisma";
import { ageBucket, scoreMatch } from "./logic";
import { vehicleDisplay } from "./vehicle-display";
import { listIndents, getIndentById } from "./services/indent.service";
import { listDocuments } from "./services/document.service";
import {
  safeQuery,
  EMPTY_DASHBOARD,
  EMPTY_ONBOARDING_QUEUE,
  EMPTY_FORM_OPTIONS,
  EMPTY_CLIENT_PORTAL,
  EMPTY_VENDOR_PORTAL,
  EMPTY_AGEING,
} from "./safe-query";
import { parsePagination, paginated, type PageParams } from "./pagination";
import { cached } from "./cache";
import { dashboardCacheKey } from "./invalidate-dashboard-cache";
import {
  assertBucketsSumToTotal,
  buildBookingBuckets,
  buildIndentBuckets,
  indentDraftCount,
  pendingPodCount,
  tripStartedCount,
  TRIP_ACTIVE_STATUSES,
  TRIP_DELIVERED_GROUP,
  TRIP_IN_TRANSIT_STATUSES,
} from "./dashboard-metrics";
import {
  computeTripCustomerRevenue,
  computeTripCustomerSettlement,
  resolveTripInvoiceBilling,
} from "./finance-reconciliation";
import { NON_PAYABLE_INVOICE_STATUSES } from "./invoice-payment";
import {
  getOnboardingCase,
  listOnboardingQueue as fetchOnboardingQueue,
  type OnboardingEntityType,
} from "./services/onboarding.service";
import { filterEligibleVendorIds } from "./vendor-onboarding-eligibility";

const n = (d: { toNumber(): number } | number | null | undefined) =>
  d == null ? 0 : typeof d === "number" ? d : d.toNumber();

/** Read with safe fallback on DB / schema errors */
async function safeRead<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  return safeQuery(label, fn, fallback);
}

const vehicleSelect = { registrationNumber: true, vehicleTypeCode: true } as const;

const driverTripSelect = {
  name: true,
  phone: true,
  dlNumber: true,
  users: { select: { name: true }, take: 1 },
} as const;

function tripDriverDisplay(
  driver: {
    name: string;
    phone: string;
    dlNumber: string;
    users?: { name: string | null }[];
  } | null
) {
  if (!driver) return null;
  const portalName = driver.users?.[0]?.name?.trim();
  const name =
    driver.name.trim().toUpperCase() === "MOCK DRIVER" && portalName ? portalName : driver.name;
  return { name, phone: driver.phone, dlNumber: driver.dlNumber };
}

function mapDocs(docs: Awaited<ReturnType<typeof listDocuments>>) {
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    url: d.url,
    name: d.name,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
  }));
}

type AddrLike = {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string | null;
};

function formatAddressLine(addr: AddrLike | null | undefined) {
  if (!addr) return null;
  return [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
}

function primaryAddress<T extends { type: string; isPrimary: boolean; address: AddrLike }>(
  addresses: T[],
  type = "BILLING"
) {
  return addresses.find((a) => a.type === type) ?? addresses.find((a) => a.isPrimary) ?? addresses[0];
}

async function onboardingFields(entityType: OnboardingEntityType, entityId: string) {
  const case_ = await getOnboardingCase(entityType, entityId);
  return {
    onboardingStatus: case_?.status ?? "PENDING",
    onboardingRemarks: case_?.remarks ?? null,
  };
}

export async function getDashboard() {
  return safeQuery("getDashboard", () =>
    cached(dashboardCacheKey(), 10, async () => {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { runAllSlaEscalations } = await import("./services/sla-escalation.service");
      await runAllSlaEscalations();
      const { countWorkQueues } = await import("./services/work-queues.service");
      const { computeOutstandingVendorPayables } = await import("./services/vendor-payables.service");

      const [
        activeTrips,
        activeClients,
        activeVendors,
        queues,
        invoiceOutstanding,
        vendorPayables,
        monthRevenueAgg,
        recentTrips,
        docExpiryVehicles,
        docExpiryDrivers,
        tripGroups,
        indentGroups,
        totalVehicles,
        totalIndents,
        activeVehicleCount,
        importantEventsOpen,
        clientPaymentsMonth,
        externalAdvanceCount,
      ] = await Promise.all([
        prisma.trip.count({ where: { status: { in: ["PENDING", "DISPATCHED", "IN_TRANSIT"] } } }),
        prisma.client.count({ where: { isActive: true } }),
        prisma.vendor.count({ where: { isActive: true } }),
        countWorkQueues(),
        prisma.clientInvoice.aggregate({
          where: { status: { in: ["SENT", "UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
          _sum: { totalAmount: true, paidAmount: true },
          _count: { _all: true },
        }),
        computeOutstandingVendorPayables(),
        prisma.trip.aggregate({
          where: { createdAt: { gte: monthStart } },
          _sum: {
            clientRate: true,
            clientLoadingCharge: true,
            clientUnloadingCharge: true,
            vendorRate: true,
          },
        }),
        prisma.trip.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { client: { select: { name: true } }, vendor: { select: { name: true } } },
        }),
        prisma.vehicleCompliance.count({
          where: {
            vehicle: { isActive: true },
            OR: [
              { insuranceExpiry: { gte: now, lte: in30 } },
              { fitnessExpiry: { gte: now, lte: in30 } },
              { pucExpiry: { gte: now, lte: in30 } },
            ],
          },
        }),
        prisma.driver.count({
          where: { isActive: true, dlExpiry: { gte: now, lte: in30 } },
        }),
        prisma.trip.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.indent.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.vehicle.count(),
        prisma.indent.count(),
        prisma.vehicle.count({ where: { isActive: true } }),
        prisma.importantEvent.count({ where: { status: "OPEN" } }),
        prisma.clientPayment.aggregate({
          where: { paidAt: { gte: monthStart } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.advanceRequest.count({ where: { source: "EXTERNAL", status: "EXTERNAL" } }),
      ]);

      const placementPending = queues.placement;
      const podsPendingVerification = queues.podVerification;
      const badPodTasks = queues.openBadPods;
      const invoiceTasksPending = queues.invoiceWork;

      const tripStatus: Record<string, number> = {};
      let tripsTotal = 0;
      for (const g of tripGroups) {
        tripStatus[g.status] = g._count._all;
        tripsTotal += g._count._all;
      }
      const indentStatus: Record<string, number> = {};
      for (const g of indentGroups) indentStatus[g.status] = g._count._all;

      const pendingInvoiceAmount =
        n(invoiceOutstanding._sum.totalAmount) - n(invoiceOutstanding._sum.paidAmount);
      const monthlyRevenue =
        n(monthRevenueAgg._sum.clientRate) +
        n(monthRevenueAgg._sum.clientLoadingCharge) +
        n(monthRevenueAgg._sum.clientUnloadingCharge);
      const monthlyMargin = monthlyRevenue - n(monthRevenueAgg._sum.vendorRate);
      const docExpiries = docExpiryVehicles + docExpiryDrivers;

      const bookingBuckets = buildBookingBuckets(tripStatus);
      const indentBuckets = buildIndentBuckets(indentStatus);
      assertBucketsSumToTotal(bookingBuckets, tripsTotal, "bookings");
      assertBucketsSumToTotal(indentBuckets, totalIndents, "indents");

      const inProgressTrips = tripStartedCount(tripStatus);
      const pendingPodsCount = pendingPodCount(tripStatus);

      return {
        activeTrips,
        activeClients,
        activeVendors,
        pendingPods: pendingPodsCount,
        pendingInvoiceAmount,
        invoiceCount: invoiceOutstanding._count._all,
        vendorPayables,
        monthlyRevenue,
        monthlyMargin,
        docExpiries,
        tripsTotal,
        tripStatus,
        bookingBuckets,
        indentBuckets,
        inProgressTrips,
        totalVehicles,
        activeVehicles: activeVehicleCount,
        totalIndents,
        indentStatus,
        indentsDraft: indentDraftCount(indentStatus),
        importantEventsOpen,
        placementPending,
        podsPendingVerification,
        badPodTasks,
        invoiceTasksPending,
        clientPaymentsThisMonth: n(clientPaymentsMonth._sum.amount),
        clientPaymentsCount: clientPaymentsMonth._count._all,
        externalAdvanceCount,
        recentTrips: recentTrips.map((t) => ({
          id: t.id,
          lrNumber: t.lrNumber,
          route: `${t.routeFrom} → ${t.routeTo}`,
          client: t.client.name,
          vendor: t.vendor.name,
          status: t.status,
        })),
      };
    }),
    EMPTY_DASHBOARD
  );
}

export async function getClients() {
  return safeRead("getClients", [], async () => {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { _count: { select: { trips: true } }, commercial: true },
    });
    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      contactName: c.contactName,
      phone: c.phone,
      gstin: c.gstin,
      paymentTerms: c.commercial?.paymentTermsDays ?? null,
      creditLimit: n(c.commercial?.creditLimit),
      isActive: c.isActive,
      trips: c._count.trips,
    }));
  });
}

export async function getClientsPaginated(params?: PageParams) {
  const { skip, take, page, pageSize } = parsePagination(params);
  return safeRead("getClientsPaginated", paginated([], 0, page, pageSize), async () => {
    const [total, rows] = await Promise.all([
      prisma.client.count(),
      prisma.client.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { _count: { select: { trips: true, requirements: true, invoices: true } } },
      }),
    ]);
    return paginated(rows, total, page, pageSize);
  });
}

export async function getVendors() {
  return safeRead("getVendors", [], async () => {
    const vendors = await prisma.vendor.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { _count: { select: { vehicles: true } } },
    });
    return vendors.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      contactName: v.contactName,
      phone: v.phone,
      rating: v.rating ? n(v.rating) : null,
      vehicles: v._count.vehicles,
      isActive: v.isActive,
    }));
  });
}

export async function getVehicles() {
  return safeRead("getVehicles", [], async () => {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { createdAt: "desc" },
      include: { vendor: { select: { name: true } }, compliance: true },
    });
    return vehicles.map((v) => ({
      ...vehicleDisplay(v),
      capacity: v.capacityTons ? `${n(v.capacityTons)} MT` : null,
      owner: v.vendor?.name ?? "—",
      insuranceExpiry: v.compliance?.insuranceExpiry ?? null,
      fitnessExpiry: v.compliance?.fitnessExpiry ?? null,
      pucExpiry: v.compliance?.pucExpiry ?? null,
    }));
  });
}

export async function getDrivers() {
  return safeRead("getDrivers", [], async () => {
    const drivers = await prisma.driver.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { trips: true } } },
    });
    return drivers.map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      dlNumber: d.dlNumber,
      dlExpiry: d.dlExpiry,
      deviceType: d.deviceType,
      otpVerified: d.otpVerified,
      accountStatus: d.accountStatus,
      city: d.city,
      trips: d._count.trips,
    }));
  });
}

export async function getRequirements(filters?: { source?: string }) {
  return safeRead("getRequirements", [], async () => {
    const requirements = await prisma.requirement.findMany({
      where: filters?.source ? { source: filters.source } : undefined,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } }, indent: { select: { id: true } } },
    });
    return requirements.map((r) => ({
      id: r.id,
      reqNumber: r.reqNumber,
      client: r.client.name,
      route: `${r.routeFrom} → ${r.routeTo}`,
      vehicleType: r.vehicleTypeCode,
      quantity: r.vehicleQuantity,
      allocated: r.indent ? 1 : 0,
      expectedDate: r.expectedAt,
      clientRate: n(r.clientRate),
      status: r.status,
    }));
  });
}

export async function getTrips() {
  return safeRead("getTrips", [], async () => {
    const trips = await prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        vendor: { select: { name: true } },
        vehicle: { select: vehicleSelect },
      },
    });
    return trips.map((t) => ({
      id: t.id,
      lrNumber: t.lrNumber,
      route: `${t.routeFrom} → ${t.routeTo}`,
      client: t.client.name,
      vendor: t.vendor.name,
      vehicle: t.vehicle.registrationNumber,
      clientRate: n(t.clientRate),
      vendorRate: n(t.vendorRate),
      margin: n(t.margin),
      status: t.status,
    }));
  });
}

export async function getInvoices() {
  return safeRead("getInvoices", [], async () => {
    const invoices = await prisma.clientInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } }, _count: { select: { lines: true } } },
    });
    return invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      client: i.client.name,
      trips: i._count.lines,
      subTotal: n(i.subTotal),
      gstAmount: n(i.gstAmount),
      totalAmount: n(i.totalAmount),
      paidAmount: n(i.paidAmount),
      dueDate: i.dueDate,
      status: i.status,
    }));
  });
}

export async function getPayments() {
  return safeRead("getPayments", [], async () => {
    const payments = await prisma.vendorPayment.findMany({
      orderBy: { createdAt: "desc" },
      include: { vendor: { select: { name: true } }, trip: { select: { lrNumber: true } } },
    });
    return payments.map((p) => ({
      id: p.id,
      vendor: p.vendor.name,
      lrNumber: p.trip.lrNumber,
      amount: n(p.amount),
      advanceAmount: n(p.advanceAmount),
      tdsAmount: n(p.tdsAmount),
      netPayable: n(p.netPayable),
      status: p.status,
    }));
  });
}

export async function getFormOptions() {
  return safeRead("getFormOptions", EMPTY_FORM_OPTIONS, async () => {
    const [clients, vendors, vehicles, drivers] = await Promise.all([
      prisma.client.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.vendor.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.vehicle.findMany({
        where: { isActive: true },
        select: { id: true, registrationNumber: true, vehicleTypeCode: true },
        orderBy: { registrationNumber: "asc" },
      }),
      prisma.driver.findMany({
        where: { isActive: true },
        select: { id: true, name: true, phone: true, dlNumber: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const eligibleVendorIds = await filterEligibleVendorIds(vendors.map((v) => v.id));
    return {
      clients,
      vendors: vendors.filter((v) => eligibleVendorIds.has(v.id)),
      vehicles: vehicles.map((v) => vehicleDisplay(v)),
      drivers,
    };
  });
}

export async function getBillableTrips() {
  return safeRead("getBillableTrips", [], async () => {
    const { runSlaEscalations } = await import("./services/sla-escalation.service");
    const { SLA_TYPES } = await import("./sla-types");
    await runSlaEscalations([SLA_TYPES.INVOICE]);

    const trips = await prisma.trip.findMany({
      where: { status: "CLOSED", invoiceLines: { none: {} } },
      orderBy: { podVerifiedAt: "asc" },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            legalName: true,
            gstin: true,
            accountsEmail: true,
            email: true,
            commercial: { select: { paymentTermsDays: true } },
            addresses: { include: { address: true } },
          },
        },
        vehicle: { select: { registrationNumber: true } },
        indent: {
          select: {
            indentNumber: true,
            cargo: { select: { description: true } },
            clientFreight: { select: { gstRate: true } },
            loading: { select: { city: true } },
            unloading: { select: { city: true } },
          },
        },
        invoiceTask: {
          select: { id: true, status: true, deadlineAt: true, podVerifiedAt: true, slaBreachedAt: true },
        },
      },
    });

    return trips.map((t) => {
      const gstRate = t.indent?.clientFreight?.gstRate != null
        ? n(t.indent.clientFreight.gstRate)
        : 0.18;
      const billingAddr =
        t.client.addresses.find((a) => a.type === "BILLING") ??
        t.client.addresses.find((a) => a.isPrimary) ??
        t.client.addresses[0];
      const billingDefaults = {
        billingName: t.client.legalName ?? t.client.name,
        billingGstin: t.client.gstin,
        billingAddress: billingAddr
          ? formatAddressLine(billingAddr.address)
          : null,
        billingEmail: t.client.accountsEmail ?? t.client.email,
        paymentTermsDays: t.client.commercial?.paymentTermsDays ?? 30,
      };
      const origin = t.indent?.loading?.city ?? t.routeFrom;
      const destination = t.indent?.unloading?.city ?? t.routeTo;
      const cargo =
        t.cargoSummary ??
        t.indent?.cargo?.description ??
        null;
      const amount = n(t.clientRate);
      const lineBase = {
        tripId: t.id,
        gstRate,
        lrNumber: t.lrNumber,
        routeFrom: origin,
        routeTo: destination,
        cargoSummary: cargo,
        vehicleReg: t.vehicle.registrationNumber,
        indentNumber: t.indent?.indentNumber ?? null,
      };
      type BillableLineKind = "FREIGHT" | "LOADING" | "UNLOADING";
      type BillableLine = typeof lineBase & {
        lineKind: BillableLineKind;
        amount: number;
        gstAmount: number;
        description: string | null;
      };
      const lineDefaults: BillableLine = {
        ...lineBase,
        lineKind: "FREIGHT",
        amount,
        gstAmount: Math.round(amount * gstRate * 100) / 100,
        description: cargo,
      };
      const invoiceLines: BillableLine[] = [lineDefaults];
      const loadingAmt = n(t.clientLoadingCharge);
      if (loadingAmt > 0) {
        invoiceLines.push({
          ...lineBase,
          lineKind: "LOADING",
          amount: loadingAmt,
          gstAmount: Math.round(loadingAmt * gstRate * 100) / 100,
          description: `Loading charges — ${t.lrNumber}`,
        });
      }
      const unloadingAmt = n(t.clientUnloadingCharge);
      if (unloadingAmt > 0) {
        invoiceLines.push({
          ...lineBase,
          lineKind: "UNLOADING",
          amount: unloadingAmt,
          gstAmount: Math.round(unloadingAmt * gstRate * 100) / 100,
          description: `Unloading charges — ${t.lrNumber}`,
        });
      }
      const task = t.invoiceTask;
      const now = Date.now();
      const slaBreached =
        task?.status === "SLA_BREACHED" ||
        (task?.status === "PENDING" && task.deadlineAt && task.deadlineAt.getTime() < now);

      return {
        id: t.id,
        indentId: t.indentId,
        lrNumber: t.lrNumber,
        clientId: t.client.id,
        client: t.client.name,
        route: `${t.routeFrom} → ${t.routeTo}`,
        clientRate: n(t.clientRate),
        podVerifiedAt: t.podVerifiedAt,
        tripClosedAt: t.tripClosedAt,
        invoiceTask: task
          ? {
              id: task.id,
              status: task.status,
              deadlineAt: task.deadlineAt,
              podVerifiedAt: task.podVerifiedAt,
              slaBreached,
            }
          : null,
        billing: billingDefaults,
        line: lineDefaults,
        lines: invoiceLines,
      };
    });
  });
}

export async function countBillableTripsForIndent(indentId: string) {
  return safeRead("countBillableTripsForIndent", 0, async () => {
    return prisma.trip.count({
      where: { indentId, status: "CLOSED", invoiceLines: { none: {} } },
    });
  });
}

export async function getRequirementsForSelect() {
  return safeRead("getRequirementsForSelect", [], async () => {
    return prisma.requirement.findMany({
      where: { status: "OPEN" },
      select: { id: true, reqNumber: true, routeFrom: true, routeTo: true },
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function getTripDetail(id: string) {
  return safeRead("getTripDetail", null, async () => {
    const t = await prisma.trip.findFirst({
      where: { id },
      include: {
        client: { include: { addresses: { include: { address: true } } } },
        vendor: { include: { commercial: { include: { bankAccount: true } } } },
        vehicle: true,
        driver: { select: driverTripSelect },
        indent: {
          include: {
            requirement: { select: { reqNumber: true } },
            loading: { select: { city: true, state: true, scheduledAt: true } },
            unloading: { select: { city: true, state: true, scheduledAt: true } },
          },
        },
        vendorPayments: { orderBy: { createdAt: "desc" } },
        invoiceLines: { include: { invoice: { select: { id: true, invoiceNumber: true } } } },
        pings: { orderBy: { recordedAt: "desc" }, take: 20 },
        pods: { orderBy: { uploadedAt: "desc" }, select: { status: true, resolutionStatus: true } },
      },
    });
    if (!t) return null;
    const documents = await listDocuments("TRIP", id);
    const { deriveTripPodQueueState } = await import("./pod-upload-eligibility");
    const podState = deriveTripPodQueueState(t.pods);
    const billing = primaryAddress(t.client.addresses, "BILLING");
    const bank = t.vendor.commercial?.bankAccount;
    const invoice = t.invoiceLines[0]?.invoice ?? null;
    return {
      id: t.id,
      lrNumber: t.lrNumber,
      routeFrom: t.routeFrom,
      routeTo: t.routeTo,
      cargoDetails: t.cargoSummary,
      remarks: t.remarks,
      status: t.status,
      clientRate: n(t.clientRate),
      clientLoadingCharge: n(t.clientLoadingCharge),
      clientUnloadingCharge: n(t.clientUnloadingCharge),
      clientBillableTotal: computeTripCustomerRevenue({
        clientRate: n(t.clientRate),
        clientLoadingCharge: n(t.clientLoadingCharge),
        clientUnloadingCharge: n(t.clientUnloadingCharge),
      }),
      vendorRate: n(t.vendorRate),
      margin:
        Math.round(
          (computeTripCustomerRevenue({
            clientRate: n(t.clientRate),
            clientLoadingCharge: n(t.clientLoadingCharge),
            clientUnloadingCharge: n(t.clientUnloadingCharge),
          }) -
            n(t.vendorRate)) *
            100
        ) / 100,
      createdAt: t.createdAt,
      dispatchedAt: t.dispatchedAt,
      originLat: t.originLat,
      originLng: t.originLng,
      destLat: t.destLat,
      destLng: t.destLng,
      currentLat: t.currentLat,
      currentLng: t.currentLng,
      lastPingAt: t.lastPingAt,
      expectedEndAt: t.expectedEndAt,
      routeGeocodedAt: t.routeGeocodedAt,
      deliveredAt: t.deliveredAt,
      podReceivedAt: t.podReceivedAt,
      podVerifiedAt: t.podVerifiedAt,
      tripClosedAt: t.tripClosedAt,
      podState,
      client: {
        id: t.client.id,
        name: t.client.name,
        gstin: t.client.gstin,
        phone: t.client.phone,
        address: billing ? formatAddressLine(billing.address) : null,
      },
      vendor: {
        id: t.vendor.id,
        name: t.vendor.name,
        type: t.vendor.type,
        phone: t.vendor.phone,
        bankName: bank?.bankName ?? null,
        bankAccount: bank?.accountNumber ?? null,
        bankIfsc: bank?.ifsc ?? null,
      },
      vehicle: vehicleDisplay(t.vehicle),
      driver: tripDriverDisplay(t.driver),
      requirementNumber: t.indent?.requirement?.reqNumber ?? null,
      invoice: invoice ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber } : null,
      documents: mapDocs(documents),
      payments: t.vendorPayments.map((p) => ({
        id: p.id,
        paymentType: p.paymentType,
        amount: n(p.amount),
        advanceAmount: n(p.advanceAmount),
        tdsAmount: n(p.tdsAmount),
        netPayable: n(p.netPayable),
        status: p.status,
        paymentMode: p.paymentMode,
        referenceNo: p.referenceNo,
        paidAt: p.paidAt,
      })),
      pings: t.pings.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        source: p.source,
        note: p.note,
        createdAt: p.recordedAt.toISOString(),
      })),
    };
  });
}

export async function getInvoiceDetail(id: string) {
  return safeRead("getInvoiceDetail", null, async () => {
    const inv = await prisma.clientInvoice.findFirst({
      where: { id },
      include: {
        client: { include: { addresses: { include: { address: true } } } },
        lines: { include: { trip: true }, orderBy: { trip: { lrNumber: "asc" } } },
        payments: {
          orderBy: { paidAt: "desc" },
          include: {
            recordedBy: { select: { id: true, name: true } },
            proofFile: { select: { id: true, url: true, fileName: true } },
          },
        },
      },
    });
    if (!inv) return null;
    const billing = primaryAddress(inv.client.addresses, "BILLING");
    const useSnapshot = Boolean(inv.finalizedAt);
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      status: inv.status,
      finalizedAt: inv.finalizedAt,
      subTotal: n(inv.subTotal),
      gstAmount: n(inv.gstAmount),
      totalAmount: n(inv.totalAmount),
      paidAmount: n(inv.paidAmount),
      billingName: inv.billingName,
      billingGstin: inv.billingGstin,
      billingAddress: inv.billingAddress,
      billingEmail: inv.billingEmail,
      paymentTermsDays: inv.paymentTermsDays,
      client: {
        id: inv.client.id,
        name: useSnapshot && inv.billingName ? inv.billingName : inv.client.name,
        gstin: useSnapshot && inv.billingGstin ? inv.billingGstin : inv.client.gstin,
        address:
          useSnapshot && inv.billingAddress
            ? inv.billingAddress
            : billing
              ? formatAddressLine(billing.address)
              : null,
        phone: inv.client.phone,
        email: useSnapshot && inv.billingEmail ? inv.billingEmail : inv.client.email,
      },
      trips: inv.lines.map((line) => ({
        id: line.id,
        tripId: line.trip.id,
        lineKind: line.lineKind,
        lrNumber: line.lrNumber ?? line.trip.lrNumber,
        route:
          line.routeFrom && line.routeTo
            ? `${line.routeFrom} → ${line.routeTo}`
            : `${line.trip.routeFrom} → ${line.trip.routeTo}`,
        description: line.description,
        clientRate: n(line.amount),
        cargoSummary: line.cargoSummary,
        vehicleReg: line.vehicleReg,
        indentNumber: line.indentNumber,
        gstRate: line.gstRate != null ? n(line.gstRate) : null,
        gstAmount: line.gstAmount != null ? n(line.gstAmount) : null,
      })),
      payments: inv.payments.map((p) => ({
        id: p.id,
        amount: n(p.amount),
        paidAt: p.paidAt,
        paymentMode: p.paymentMode,
        referenceNo: p.referenceNo,
        chequeNumber: p.chequeNumber,
        notes: p.notes,
        recordedBy: p.recordedBy,
        proof: p.proofFile
          ? { id: p.proofFile.id, url: p.proofFile.url, fileName: p.proofFile.fileName }
          : null,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Client portal
// ---------------------------------------------------------------------------
export async function getClientPortalOverview(clientId: string) {
  return safeRead("getClientPortalOverview", EMPTY_CLIENT_PORTAL, async () => {
    const { backfillPaidInvoiceTripStatuses, resolveClientTripDisplayStatus, CLIENT_HIDDEN_INVOICE_STATUSES } =
      await import("./client-trip-sync");
    await backfillPaidInvoiceTripStatuses();

    const [client, active, inTransit, delivered, recentTrips, invoices] = await Promise.all([
      prisma.client.findFirst({ where: { id: clientId } }),
      prisma.trip.count({
        where: { clientId, status: { in: [...TRIP_ACTIVE_STATUSES] } },
      }),
      prisma.trip.count({
        where: { clientId, status: { in: [...TRIP_IN_TRANSIT_STATUSES] } },
      }),
      prisma.trip.count({
        where: { clientId, status: { in: [...TRIP_DELIVERED_GROUP] } },
      }),
      prisma.trip.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          vendor: { select: { name: true } },
          vehicle: { select: vehicleSelect },
          invoiceLines: {
            where: { invoice: { status: { notIn: CLIENT_HIDDEN_INVOICE_STATUSES } } },
            orderBy: { invoice: { createdAt: "desc" } },
            take: 1,
            include: { invoice: { select: { status: true } } },
          },
        },
      }),
      prisma.clientInvoice.findMany({
        where: { clientId },
        select: { totalAmount: true, paidAmount: true, status: true },
      }),
    ]);

    const outstanding = invoices
      .filter((i) => ["SENT", "UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(i.status))
      .reduce((s, i) => s + (n(i.totalAmount) - n(i.paidAmount)), 0);

    return {
      clientName: client?.name ?? "Client",
      active,
      inTransit,
      delivered,
      outstanding,
      recentTrips: recentTrips.map((t) => ({
        id: t.id,
        lrNumber: t.lrNumber,
        route: `${t.routeFrom} → ${t.routeTo}`,
        vehicle: t.vehicle.registrationNumber,
        vendor: t.vendor.name,
        status: resolveClientTripDisplayStatus(t.status, t.invoiceLines),
      })),
    };
  });
}

export async function getClientById(clientId: string) {
  return safeRead("getClientById", null, async () => {
    const c = await prisma.client.findFirst({ where: { id: clientId } });
    if (!c) return null;
    return { id: c.id, name: c.name };
  });
}

export async function getClientTrips(clientId: string) {
  return safeRead("getClientTrips", [], async () => {
    const { backfillPaidInvoiceTripStatuses, resolveClientTripDisplayStatus, CLIENT_HIDDEN_INVOICE_STATUSES } =
      await import("./client-trip-sync");
    await backfillPaidInvoiceTripStatuses();

    const trips = await prisma.trip.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: {
        vendor: { select: { name: true } },
        vehicle: { select: vehicleSelect },
        pings: { orderBy: { recordedAt: "desc" }, take: 1 },
        invoiceLines: {
          where: { invoice: { status: { notIn: CLIENT_HIDDEN_INVOICE_STATUSES } } },
          select: {
            amount: true,
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
                paidAmount: true,
                totalAmount: true,
                issueDate: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    return trips.map((t) => {
      const billing = resolveTripInvoiceBilling(
        t.invoiceLines.map((line) => ({
          amount: n(line.amount),
          invoice: line.invoice
            ? {
                id: line.invoice.id,
                status: line.invoice.status,
                totalAmount: n(line.invoice.totalAmount),
                paidAmount: n(line.invoice.paidAmount),
                issueDate: line.invoice.issueDate,
                createdAt: line.invoice.createdAt,
              }
            : null,
        })),
        (status) => !NON_PAYABLE_INVOICE_STATUSES.includes(status)
      );
      const invoice = billing.invoice;
      const invoiceLine = invoice
        ? t.invoiceLines.find((l) => l.invoice?.id === invoice.id)?.invoice
        : null;
      const billableTotal = computeTripCustomerRevenue({
        clientRate: n(t.clientRate),
        clientLoadingCharge: n(t.clientLoadingCharge),
        clientUnloadingCharge: n(t.clientUnloadingCharge),
      });
      const settlement = computeTripCustomerSettlement({
        lineAmount: billing.tripLineAmount,
        invoiceTotal: invoice ? n(invoice.totalAmount) : null,
        invoicePaid: invoice ? n(invoice.paidAmount) : null,
        invoicePayable: billing.invoicePayable,
        tripClientPayments: 0,
        expectedBillableTotal: billing.invoicePayable || invoice ? undefined : billableTotal,
      });
      return {
        id: t.id,
        lrNumber: t.lrNumber,
        route: `${t.routeFrom} → ${t.routeTo}`,
        vendor: t.vendor.name,
        vehicle: t.vehicle.registrationNumber,
        status: t.status,
        displayStatus: resolveClientTripDisplayStatus(t.status, t.invoiceLines),
        invoice: invoice && invoiceLine
          ? {
              id: invoice.id,
              invoiceNumber: invoiceLine.invoiceNumber,
              status: invoice.status,
              paidAmount: settlement.collected,
              totalAmount: billing.invoicePayable ? settlement.invoiceAmount : billableTotal,
              outstanding: settlement.outstanding,
            }
          : null,
        lastPing: t.pings[0]
          ? { lat: t.pings[0].lat, lng: t.pings[0].lng, note: t.pings[0].note }
          : null,
      };
    });
  });
}

export async function getClientTripDetail(clientId: string, tripId: string) {
  return safeRead("getClientTripDetail", null, async () => {
    const { resolveClientTripDisplayStatus, CLIENT_HIDDEN_INVOICE_STATUSES } =
      await import("./client-trip-sync");

    const t = await prisma.trip.findFirst({
      where: { id: tripId, clientId },
      include: {
        vendor: { select: { name: true } },
        vehicle: { select: vehicleSelect },
        pings: { orderBy: { recordedAt: "desc" }, take: 1 },
        invoiceLines: {
          where: { invoice: { status: { notIn: CLIENT_HIDDEN_INVOICE_STATUSES } } },
          orderBy: { invoice: { createdAt: "desc" } },
          take: 1,
          include: {
            invoice: { select: { id: true, invoiceNumber: true, status: true } },
          },
        },
      },
    });
    if (!t) return null;

    const latestPing = t.pings[0];
    return {
      id: t.id,
      lrNumber: t.lrNumber,
      route: `${t.routeFrom} → ${t.routeTo}`,
      vendor: t.vendor.name,
      vehicle: t.vehicle.registrationNumber,
      vehicleType: t.vehicle.vehicleTypeCode,
      status: t.status,
      displayStatus: resolveClientTripDisplayStatus(t.status, t.invoiceLines),
      invoice: t.invoiceLines[0]?.invoice ?? null,
      latestPing: latestPing
        ? {
            id: latestPing.id,
            lat: latestPing.lat,
            lng: latestPing.lng,
            note: latestPing.note,
            source: latestPing.source,
            accuracyMeters: latestPing.accuracyMeters,
            recordedAt: latestPing.recordedAt.toISOString(),
          }
        : null,
    };
  });
}

export async function getClientRequirements(clientId: string) {
  return safeRead("getClientRequirements", [], async () => {
    const reqs = await prisma.requirement.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: { indent: { select: { id: true } } },
    });
    return reqs.map((r) => ({
      id: r.id,
      reqNumber: r.reqNumber,
      route: `${r.routeFrom} → ${r.routeTo}`,
      vehicleType: r.vehicleTypeCode,
      quantity: r.vehicleQuantity,
      allocated: r.indent ? 1 : 0,
      expectedDate: r.expectedAt,
      clientRate: n(r.clientRate),
      status: r.status,
    }));
  });
}

export async function getClientInvoices(clientId: string) {
  return safeRead("getClientInvoices", [], async () => {
    const { CLIENT_HIDDEN_INVOICE_STATUSES } = await import("./client-trip-sync");
    const invoices = await prisma.clientInvoice.findMany({
      where: { clientId, status: { notIn: CLIENT_HIDDEN_INVOICE_STATUSES } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { lines: true } } },
    });
    return invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      trips: i._count.lines,
      subTotal: n(i.subTotal),
      gstAmount: n(i.gstAmount),
      totalAmount: n(i.totalAmount),
      paidAmount: n(i.paidAmount),
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      status: i.status,
    }));
  });
}

// ---------------------------------------------------------------------------
// Vendor portal
// ---------------------------------------------------------------------------
export async function getVendorOpenIndents(vendorId: string) {
  return safeRead("getVendorOpenIndents", [], async () => {
    const { listOpenIndentsForVendor } = await import("./services/quote.service");
    return listOpenIndentsForVendor(vendorId);
  });
}

export async function getVendorAllocatedIndents(vendorId: string) {
  return safeRead("getVendorAllocatedIndents", [], async () => {
    const indents = await prisma.indent.findMany({
      where: { vendorId },
      orderBy: { vendorAllocatedAt: "desc" },
      include: {
        client: { select: { name: true } },
        consignment: true,
        loading: { select: { city: true } },
        unloading: { select: { city: true } },
      },
    });
    return indents.map((i) => ({
      id: i.id,
      indentNumber: i.indentNumber,
      client: i.client.name,
      route: `${i.loading?.city ?? "—"} → ${i.unloading?.city ?? "—"}`,
      vehicleType: i.consignment?.vehicleTypeCode ?? "—",
      status: i.status,
      placementStatus: i.placementStatus,
      allocatedAt: i.vendorAllocatedAt,
    }));
  });
}

const VENDOR_DONE_ASSIGNMENT_STATUSES = new Set([
  "DELIVERED",
  "POD_RECEIVED",
  "POD_PENDING",
  "CLOSED",
  "CANCELLED",
  "INVOICED",
  "COMPLETED",
]);

export async function getVendorPortalOverview(vendorId: string) {
  return safeRead("getVendorPortalOverview", EMPTY_VENDOR_PORTAL, async () => {
    const { workQueueWhere, vendorOpenIndentWhere } = await import("./services/work-queues.service");
    const { computeOutstandingVendorPayables } = await import("./services/vendor-payables.service");
    const [vendor, assignments, delivered, pendingPodTrips, payments, availableIndents, allocatedIndents, pendingPay] =
      await Promise.all([
        prisma.vendor.findFirst({ where: { id: vendorId } }),
        getVendorTrips(vendorId),
        prisma.trip.count({
          where: { vendorId, status: { in: [...TRIP_DELIVERED_GROUP] } },
        }),
        prisma.trip.findMany({
          where: {
            vendorId,
            OR: [
              workQueueWhere.tripsAwaitingPod,
              {
                status: { not: "CANCELLED" },
                pods: { some: { status: "BAD_POD", resolutionStatus: { in: ["PENDING", "SLA_BREACHED"] } } },
              },
            ],
          },
          orderBy: { deliveredAt: "desc" },
          select: {
            id: true,
            lrNumber: true,
            routeFrom: true,
            routeTo: true,
            vehicle: { select: vehicleSelect },
          },
        }),
        (async () => {
          const { listVendorPayments } = await import("./services/vendor-payment.service");
          return listVendorPayments({ vendorId });
        })(),
        prisma.indent.count({ where: vendorOpenIndentWhere(vendorId) }),
        prisma.indent.count({ where: { vendorId } }),
        computeOutstandingVendorPayables(vendorId),
      ]);

    const active = assignments.filter((t) => !VENDOR_DONE_ASSIGNMENT_STATUSES.has(t.status)).length;
    const recentTrips = assignments.slice(0, 5);

    const paidPay = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.netPayable, 0);

    return {
      vendorName: vendor?.name ?? "Vendor",
      active,
      delivered,
      availableIndents,
      allocatedIndents,
      pendingPods: pendingPodTrips.length,
      pendingPodTrips: pendingPodTrips.map((t) => ({
        id: t.id,
        lrNumber: t.lrNumber,
        route: `${t.routeFrom} → ${t.routeTo}`,
        vehicle: t.vehicle.registrationNumber,
      })),
      pendingPay,
      paidPay,
      recentTrips: recentTrips.map((t) => ({
        id: t.id,
        href: t.href,
        lrNumber: t.lrNumber,
        route: t.route,
        vehicle: t.vehicle,
        status: t.status,
        vendorRate: t.vendorRate,
      })),
    };
  });
}

export async function getVendorTrips(vendorId: string) {
  return safeRead("getVendorTrips", [], async () => {
    const { syncTripFromIndent, resolveVendorDisplayStatus } = await import("./vendor-trip-sync");

    const trips = await prisma.trip.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        vehicle: { select: vehicleSelect },
        indent: { select: { id: true, indentNumber: true, status: true, placementStatus: true } },
      },
    });

    const indentIdsToSync = Array.from(new Set(trips.filter((t) => t.indentId).map((t) => t.indentId!)));
    for (const indentId of indentIdsToSync) {
      await syncTripFromIndent(indentId);
    }

    const refreshedTrips =
      indentIdsToSync.length > 0
        ? await prisma.trip.findMany({
            where: { vendorId },
            orderBy: { createdAt: "desc" },
            include: {
              client: { select: { name: true } },
              vehicle: { select: vehicleSelect },
              indent: { select: { id: true, indentNumber: true, status: true, placementStatus: true } },
            },
          })
        : trips;

    const pendingIndents = await prisma.indent.findMany({
      where: {
        vendorId,
        status: { notIn: ["CANCELLED", "COMPLETED", "DRAFT"] },
        trips: { none: {} },
      },
      orderBy: { vendorAllocatedAt: "desc" },
      include: {
        client: { select: { name: true } },
        loading: { select: { city: true, state: true } },
        unloading: { select: { city: true, state: true } },
        consignment: { select: { vehicleTypeCode: true } },
        allocations: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { allocatedAt: "desc" },
          select: { vendorRate: true },
        },
      },
    });

    const tripRows = refreshedTrips.map((t) => ({
      id: t.id,
      kind: "trip" as const,
      indentId: t.indentId,
      indentNumber: t.indent?.indentNumber ?? null,
      lrNumber: t.lrNumber,
      route: `${t.routeFrom} → ${t.routeTo}`,
      client: t.client.name,
      vehicle: t.vehicle.registrationNumber,
      vendorRate: n(t.vendorRate),
      status: resolveVendorDisplayStatus({
        tripStatus: t.status,
        indentStatus: t.indent?.status,
        placementStatus: t.indent?.placementStatus,
        kind: "trip",
      }),
      href: `/portal/vendor/trips/${t.id}`,
      sortAt: t.createdAt.getTime(),
    }));

    const indentRows = pendingIndents.map((i) => ({
      id: i.id,
      kind: "indent" as const,
      indentId: i.id,
      lrNumber: i.indentNumber,
      route: `${i.loading?.city ?? "—"} → ${i.unloading?.city ?? "—"}`,
      client: i.client.name,
      vehicle: i.consignment?.vehicleTypeCode?.replace(/_/g, " ") ?? "—",
      vendorRate: n(i.allocations[0]?.vendorRate),
      status: resolveVendorDisplayStatus({
        indentStatus: i.status,
        placementStatus: i.placementStatus,
        kind: "indent",
      }),
      href: `/portal/vendor/assignments/${i.id}`,
      sortAt: (i.vendorAllocatedAt ?? i.createdAt).getTime(),
    }));

    return [...tripRows, ...indentRows]
      .sort((a, b) => b.sortAt - a.sortAt)
      .map(({ sortAt: _sortAt, ...row }) => row);
  });
}

export async function getVendorTripDetail(vendorId: string, tripId: string) {
  return safeRead("getVendorTripDetail", null, async () => {
    const { syncTripFromIndent, resolveVendorDisplayStatus } = await import("./vendor-trip-sync");

    let t = await prisma.trip.findFirst({
      where: { id: tripId, vendorId },
      include: {
        client: { select: { name: true } },
        vehicle: { select: vehicleSelect },
        driver: { select: driverTripSelect },
        indent: { select: { status: true, placementStatus: true } },
        pings: { orderBy: { recordedAt: "desc" }, take: 1 },
        pods: { select: { status: true, resolutionStatus: true } },
      },
    });
    if (!t) return null;

    if (t.indentId) {
      await syncTripFromIndent(t.indentId);
      t = await prisma.trip.findFirst({
        where: { id: tripId, vendorId },
        include: {
          client: { select: { name: true } },
          vehicle: { select: vehicleSelect },
          driver: { select: driverTripSelect },
          indent: { select: { status: true, placementStatus: true } },
          pings: { orderBy: { recordedAt: "desc" }, take: 1 },
          pods: { select: { status: true, resolutionStatus: true } },
        },
      });
      if (!t) return null;
    }

    const documents = await listDocuments("TRIP", tripId);
    const latestPing = t.pings?.[0];
    const { deriveTripPodQueueState } = await import("./pod-upload-eligibility");
    const podState = deriveTripPodQueueState(t.pods ?? []);
    return {
      id: t.id,
      lrNumber: t.lrNumber,
      route: `${t.routeFrom} → ${t.routeTo}`,
      client: t.client.name,
      vehicle: t.vehicle.registrationNumber,
      vehicleType: t.vehicle.vehicleTypeCode,
      driver: tripDriverDisplay(t.driver),
      vendorRate: n(t.vendorRate),
      status: resolveVendorDisplayStatus({
        tripStatus: t.status,
        indentStatus: t.indent?.status,
        placementStatus: t.indent?.placementStatus,
        kind: "trip",
      }),
      rawStatus: t.status,
      podState,
      podReceivedAt: t.podReceivedAt,
      documents: mapDocs(documents),
      latestPing: latestPing
        ? {
            id: latestPing.id,
            lat: latestPing.lat,
            lng: latestPing.lng,
            note: latestPing.note,
            source: latestPing.source,
            accuracyMeters: latestPing.accuracyMeters,
            recordedAt: latestPing.recordedAt.toISOString(),
          }
        : null,
    };
  });
}

export async function getVendorPayments(vendorId: string) {
  return safeRead("getVendorPayments", [], async () => {
    const { listVendorPayments } = await import("./services/vendor-payment.service");
    const payments = await listVendorPayments({ vendorId });

    const PAYMENT_TYPE_LABELS: Record<string, string> = {
      ADVANCE: "Advance",
      BALANCE: "Balance",
      OTHER: "Other",
    };

    return payments.map((p) => ({
      id: p.id,
      tripId: p.tripId,
      paymentType: p.paymentType,
      paymentTypeLabel: PAYMENT_TYPE_LABELS[p.paymentType] ?? p.paymentType,
      lrNumber: p.trip.lrNumber,
      route: `${p.trip.routeFrom} → ${p.trip.routeTo}`,
      amount: p.amount,
      advanceAmount: p.advanceAmount,
      tdsAmount: p.tdsAmount,
      netPayable: p.netPayable,
      paidAmount: p.netPayable,
      status: p.status,
      paymentMode: p.paymentMode,
      referenceNo: p.referenceNo,
      chequeNumber: p.chequeNumber,
      paidAt: p.paidAt,
      notes: p.notes,
      proofUrl: p.proof?.url ?? null,
      voucherUrl:
        p.paymentType === "ADVANCE" && p.sourceType === "ADVANCE_REQUEST" && p.sourceId
          ? `/portal/vendor/advances/${p.sourceId.replace("advance:", "")}/voucher`
          : null,
    }));
  });
}

export async function getVendorById(vendorId: string) {
  return safeRead("getVendorById", null, async () => {
    const v = await prisma.vendor.findFirst({
      where: { id: vendorId },
      include: { commercial: { include: { bankAccount: true } } },
    });
    if (!v) return null;
    const bank = v.commercial?.bankAccount;
    return {
      name: v.name,
      type: v.type,
      contactName: v.contactName,
      phone: v.phone,
      email: v.email,
      gstin: v.gstin,
      bankName: bank?.bankName ?? null,
      bankAccount: bank?.accountNumber ?? null,
      bankIfsc: bank?.ifsc ?? null,
      rating: v.rating ? n(v.rating) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Requirement detail + vendor auto-matching
// ---------------------------------------------------------------------------
export async function getRequirementDetail(id: string) {
  return safeRead("getRequirementDetail", null, async () => {
    const r = await prisma.requirement.findFirst({
      where: { id },
      include: {
        client: true,
        indent: {
          include: {
            trips: {
              include: {
                vendor: { select: { name: true } },
                vehicle: { select: vehicleSelect },
              },
            },
          },
        },
      },
    });
    if (!r) return null;
    const trips = r.indent?.trips ?? [];
    return {
      id: r.id,
      reqNumber: r.reqNumber,
      status: r.status,
      indentId: r.indent?.id ?? null,
      routeFrom: r.routeFrom,
      routeTo: r.routeTo,
      vehicleType: r.vehicleTypeCode,
      quantity: r.vehicleQuantity,
      cargoDetails: r.cargoSummary,
      expectedDate: r.expectedAt,
      clientRate: n(r.clientRate),
      client: {
        id: r.client.id,
        name: r.client.name,
        gstin: r.client.gstin,
        phone: r.client.phone,
      },
      allocated: trips.length,
      trips: trips.map((t) => ({
        id: t.id,
        lrNumber: t.lrNumber,
        vendor: t.vendor.name,
        vehicle: t.vehicle.registrationNumber,
        status: t.status,
      })),
    };
  });
}

export type VendorMatch = {
  vehicleId: string;
  vehicleNumber: string;
  vehicleType: string;
  capacity: string | null;
  vendorId: string;
  vendorName: string;
  vendorType: string;
  rating: number | null;
  score: number;
  reasons: string[];
};

export async function matchVendorsForRequirement(requirementId: string): Promise<VendorMatch[]> {
  return safeRead("matchVendorsForRequirement", [], async () => {
    const req = await prisma.requirement.findFirst({ where: { id: requirementId } });
    if (!req) return [];

    const [vehicles, laneTrips, activeTrips] = await Promise.all([
      prisma.vehicle.findMany({
        where: { isActive: true },
        include: { vendor: true },
      }),
      prisma.trip.findMany({
        where: {
          OR: [
            { routeFrom: req.routeFrom, routeTo: req.routeTo },
            { routeFrom: req.routeTo, routeTo: req.routeFrom },
          ],
        },
        select: { vendorId: true, vehicleId: true },
      }),
      prisma.trip.findMany({
        where: { status: { in: ["PENDING", "DISPATCHED", "IN_TRANSIT"] } },
        select: { vehicleId: true },
      }),
    ]);

    const busyVehicles = new Set(activeTrips.map((t) => t.vehicleId));
    const laneByVehicle = new Map<string, number>();
    for (const t of laneTrips) {
      laneByVehicle.set(t.vehicleId, (laneByVehicle.get(t.vehicleId) ?? 0) + 1);
    }

    const matches: VendorMatch[] = vehicles.map((v) => {
      const rating = v.vendor?.rating ? n(v.vendor.rating) : 0;
      const lane = laneByVehicle.get(v.id) ?? 0;
      const { score, reasons } = scoreMatch({
        vehicleType: v.vehicleTypeCode,
        requirementType: req.vehicleTypeCode,
        rating,
        laneCount: lane,
        busy: busyVehicles.has(v.id),
      });

      return {
        vehicleId: v.id,
        vehicleNumber: v.registrationNumber,
        vehicleType: v.vehicleTypeCode,
        capacity: v.capacityTons ? `${n(v.capacityTons)} MT` : null,
        vendorId: v.vendor?.id ?? "",
        vendorName: v.vendor?.name ?? "—",
        vendorType: v.vendor?.type ?? "FLEET_OWNER",
        rating: rating || null,
        score,
        reasons,
      };
    });

    return matches.sort((a, b) => b.score - a.score).slice(0, 6);
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export async function getLaneRates() {
  return safeRead("getLaneRates", [], async () => {
    const trips = await prisma.trip.findMany({
      select: {
        routeFrom: true,
        routeTo: true,
        clientRate: true,
        clientLoadingCharge: true,
        clientUnloadingCharge: true,
        vendorRate: true,
      },
    });
    const map = new Map<
      string,
      { route: string; count: number; clientSum: number; vendorSum: number; marginSum: number; min: number; max: number }
    >();
    for (const t of trips) {
      const key = `${t.routeFrom}→${t.routeTo}`;
      const cr = computeTripCustomerRevenue({
        clientRate: n(t.clientRate),
        clientLoadingCharge: n(t.clientLoadingCharge),
        clientUnloadingCharge: n(t.clientUnloadingCharge),
      });
      const vr = n(t.vendorRate);
      const mg = cr - vr;
      const cur = map.get(key);
      if (cur) {
        cur.count++;
        cur.clientSum += cr;
        cur.vendorSum += vr;
        cur.marginSum += mg;
        cur.min = Math.min(cur.min, cr);
        cur.max = Math.max(cur.max, cr);
      } else {
        map.set(key, {
          route: `${t.routeFrom} → ${t.routeTo}`,
          count: 1,
          clientSum: cr,
          vendorSum: vr,
          marginSum: mg,
          min: cr,
          max: cr,
        });
      }
    }
    return Array.from(map.values())
      .map((r) => ({
        route: r.route,
        count: r.count,
        avgClient: Math.round(r.clientSum / r.count),
        avgVendor: Math.round(r.vendorSum / r.count),
        avgMargin: Math.round(r.marginSum / r.count),
        min: r.min,
        max: r.max,
      }))
      .sort((a, b) => b.count - a.count);
  });
}

export async function getClientProfitability() {
  return safeRead("getClientProfitability", [], async () => {
    const clients = await prisma.client.findMany({
      include: {
        trips: {
          select: {
            clientRate: true,
            clientLoadingCharge: true,
            clientUnloadingCharge: true,
            vendorRate: true,
          },
        },
        invoices: { select: { totalAmount: true, paidAmount: true, status: true } },
      },
    });
    return clients
      .map((c) => {
        const revenue = c.trips.reduce(
          (s, t) =>
            s +
            computeTripCustomerRevenue({
              clientRate: n(t.clientRate),
              clientLoadingCharge: n(t.clientLoadingCharge),
              clientUnloadingCharge: n(t.clientUnloadingCharge),
            }),
          0
        );
        const cost = c.trips.reduce((s, t) => s + n(t.vendorRate), 0);
        const margin = Math.round((revenue - cost) * 100) / 100;
        const outstanding = c.invoices
          .filter((i) => ["SENT", "UNPAID", "PARTIALLY_PAID", "OVERDUE"].includes(i.status))
          .reduce((s, i) => s + (n(i.totalAmount) - n(i.paidAmount)), 0);
        return {
          name: c.name,
          trips: c.trips.length,
          revenue,
          cost,
          margin,
          marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
          outstanding,
        };
      })
      .sort((a, b) => b.margin - a.margin);
  });
}

export async function getVendorScorecard() {
  return safeRead("getVendorScorecard", [], async () => {
    const vendors = await prisma.vendor.findMany({
      include: {
        trips: {
          select: {
            status: true,
            clientRate: true,
            clientLoadingCharge: true,
            clientUnloadingCharge: true,
            vendorRate: true,
          },
        },
        payments: { select: { netPayable: true, status: true } },
      },
    });
    return vendors
      .map((v) => {
        const completed = v.trips.filter((t) => TRIP_DELIVERED_GROUP.includes(t.status as typeof TRIP_DELIVERED_GROUP[number])).length;
        const active = v.trips.filter((t) =>
          TRIP_ACTIVE_STATUSES.includes(t.status as typeof TRIP_ACTIVE_STATUSES[number])
        ).length;
        const margin = v.trips.reduce((s, t) => {
          const revenue = computeTripCustomerRevenue({
            clientRate: n(t.clientRate),
            clientLoadingCharge: n(t.clientLoadingCharge),
            clientUnloadingCharge: n(t.clientUnloadingCharge),
          });
          return s + (revenue - n(t.vendorRate));
        }, 0);
        const pendingPay = v.payments
          .filter((p) => p.status !== "PAID")
          .reduce((s, p) => s + n(p.netPayable), 0);
        return {
          name: v.name,
          type: v.type,
          rating: v.rating ? n(v.rating) : null,
          trips: v.trips.length,
          completed,
          active,
          completionPct: v.trips.length > 0 ? Math.round((completed / v.trips.length) * 100) : 0,
          marginGenerated: margin,
          pendingPay,
        };
      })
      .sort((a, b) => b.trips - a.trips);
  });
}

export async function getOutstandingAgeing() {
  return safeRead("getOutstandingAgeing", EMPTY_AGEING, async () => {
    const { buildReportOutstandingAgeing, OUTSTANDING_INVOICE_STATUSES } = await import(
      "./receivables"
    );
    const invoices = await prisma.clientInvoice.findMany({
      where: { status: { in: [...OUTSTANDING_INVOICE_STATUSES] } },
      include: { client: { select: { name: true } } },
    });
    const result = buildReportOutstandingAgeing(
      invoices.map((inv) => ({
        clientName: inv.client.name,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: n(inv.totalAmount),
        paidAmount: n(inv.paidAmount),
        status: inv.status,
        dueDate: inv.dueDate,
        issueDate: inv.issueDate,
        finalizedAt: inv.finalizedAt,
      }))
    );
    const rowSum = result.rows.reduce((s, r) => s + r.balance, 0);
    if (Math.abs(result.total - rowSum) > 0.01) {
      console.error(`[getOutstandingAgeing] bucket total ${result.total} !== row sum ${rowSum}`);
    }
    return result;
  });
}

export async function getNotifications() {
  return safeRead("getNotifications", [], async () => {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      include: { trip: { select: { lrNumber: true } } },
    });
    return notifications.map((x) => ({
      id: x.id,
      channel: x.channel,
      to: x.to,
      subject: x.subject,
      body: x.body,
      lrNumber: x.trip?.lrNumber ?? null,
      status: x.status,
      createdAt: x.createdAt,
      sentAt: x.sentAt,
    }));
  });
}

export async function getUsers() {
  return safeRead("getUsers", [], async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true } },
        vendor: { select: { name: true } },
        driver: { select: { name: true } },
        team: { select: { name: true, code: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      name: u.name,
      role: u.role,
      accessMode: u.accessMode,
      teamId: u.teamId,
      teamName: u.team?.name ?? null,
      teamCode: u.team?.code ?? null,
      employeeCode: u.employeeCode,
      jobTitle: u.jobTitle,
      clientId: u.clientId,
      vendorId: u.vendorId,
      driverId: u.driverId,
      linked: u.client?.name ?? u.vendor?.name ?? u.driver?.name ?? null,
      createdAt: u.createdAt,
      isActive: u.isActive,
    }));
  });
}

export type AuditLogFilters = {
  userId?: string;
  teamCode?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  tripId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function getAuditLogs(filters: AuditLogFilters = {}) {
  const limit = filters.limit ?? 200;
  const cacheKey = JSON.stringify(filters);
  return safeRead(`getAuditLogs:${cacheKey}`, [], async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.teamCode ? { teamCode: filters.teamCode } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entity ? { entity: filters.entity } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actor: { select: { id: true, name: true, employeeCode: true } },
      },
    });
    return logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      userEmail: l.userEmail,
      actorName: l.actor?.name ?? null,
      employeeCode: l.actor?.employeeCode ?? null,
      teamCode: l.teamCode,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      tripId: l.tripId,
      meta: l.meta,
      before: l.before,
      after: l.after,
      createdAt: l.createdAt,
    }));
  });
}

export async function getAuditFilterOptions() {
  return safeRead("getAuditFilterOptions", { employees: [], teams: [], actions: [] }, async () => {
    const [employees, teams, distinctActions] = await Promise.all([
      prisma.user.findMany({
        where: { teamId: { not: null }, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, employeeCode: true, team: { select: { code: true } } },
      }),
      prisma.team.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
    ]);
    return {
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        employeeCode: e.employeeCode,
        teamCode: e.team?.code ?? null,
      })),
      teams,
      actions: distinctActions.map((a) => a.action),
    };
  });
}

// ---------------------------------------------------------------------------
// Indent
// ---------------------------------------------------------------------------
export async function getIndents() {
  return safeRead("getIndents", [], () => listIndents());
}

export async function getIndentQuotes(indentId: string, limit = 50) {
  return safeRead("getIndentQuotes", [], async () => {
    const { listQuotesForIndent } = await import("./services/quote.service");
    const quotes = await listQuotesForIndent(indentId, limit);
    return quotes ?? [];
  });
}

export async function getIndentDetail(id: string) {
  return safeRead("getIndentDetail", null, async () => {
    const trip = await prisma.trip.findFirst({
      where: { indentId: id },
      select: { id: true },
    });
    if (trip) {
      const { syncOrphanTripPodUploads } = await import("./services/pod.service");
      await syncOrphanTripPodUploads(trip.id);
    }
    return getIndentById(id);
  });
}

// ---------------------------------------------------------------------------
// Placement + Important Events + Driver current indent
// ---------------------------------------------------------------------------
export async function getPlacementQueue() {
  return safeRead("getPlacementQueue", [], async () => {
    const { evaluatePlacementDeadlines, listPlacementQueue } = await import("./services/placement.service");
    await evaluatePlacementDeadlines();
    return listPlacementQueue();
  });
}

export async function getImportantEvents(status?: string) {
  return safeRead("getImportantEvents", [], async () => {
    const { listImportantEvents } = await import("./services/important-event.service");
    return listImportantEvents(status ? { status } : undefined);
  });
}

export async function getDriverCurrentIndent(driverId: string) {
  return safeRead("getDriverCurrentIndent", null, async () => {
    const { getDriverCurrentIndent } = await import("./services/driver.service");
    return getDriverCurrentIndent(driverId);
  });
}

// ---------------------------------------------------------------------------
// Onboarding detail views
// ---------------------------------------------------------------------------
export async function getClientDetail(id: string) {
  return safeRead("getClientDetail", null, async () => {
    const c = await prisma.client.findFirst({
      where: { id },
      include: {
        commercial: { include: { bankAccount: true } },
        addresses: { include: { address: true } },
        _count: { select: { trips: true, invoices: true, indents: true } },
      },
    });
    if (!c) return null;
    const billing = primaryAddress(c.addresses, "BILLING");
    const shipping = primaryAddress(c.addresses, "SHIPPING");
    const addr = billing?.address;
    const shipAddr = shipping?.address;
    const bank = c.commercial?.bankAccount;
    const onboarding = await onboardingFields("CLIENT", id);
    const documents = await listDocuments("CLIENT", id);
    return {
      id: c.id,
      name: c.name,
      legalName: c.legalName,
      industry: c.industry,
      website: c.website,
      contactName: c.contactName,
      phone: c.phone,
      altPhone: c.altPhone,
      email: c.email,
      accountsEmail: c.accountsEmail,
      gstin: c.gstin,
      pan: c.pan,
      cin: c.cin,
      msme: c.msme,
      businessType: c.businessType,
      onboardingPreference: c.onboardingPreference,
      gstVerificationStatus: c.gstVerificationStatus,
      gstVerifiedAt: c.gstVerifiedAt,
      gstVerificationProvider: c.gstVerificationProvider,
      isActive: c.isActive,
      notes: c.notes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      billingAddress: addr ? formatAddressLine(addr) : null,
      addressLine1: addr?.line1 ?? null,
      addressLine2: addr?.line2 ?? null,
      city: addr?.city ?? null,
      state: addr?.state ?? null,
      pincode: addr?.pincode ?? null,
      country: addr?.country ?? null,
      shippingAddress: shipAddr ? formatAddressLine(shipAddr) : null,
      shippingCity: shipAddr?.city ?? null,
      shippingState: shipAddr?.state ?? null,
      shippingPincode: shipAddr?.pincode ?? null,
      paymentTerms: c.commercial?.paymentTermsDays ?? null,
      creditLimit: n(c.commercial?.creditLimit),
      securityDeposit: n(c.commercial?.securityDeposit),
      bankName: bank?.bankName ?? null,
      bankAccount: bank?.accountNumber ?? null,
      bankIfsc: bank?.ifsc ?? null,
      bankBranch: bank?.branch ?? null,
      accountHolder: bank?.accountHolder ?? null,
      ...onboarding,
      counts: c._count,
      documents: mapDocs(documents),
    };
  });
}

export async function getVendorDetail(id: string) {
  return safeRead("getVendorDetail", null, async () => {
    const v = await prisma.vendor.findFirst({
      where: { id },
      include: {
        commercial: { include: { bankAccount: true } },
        addresses: { include: { address: true } },
        deliveryZones: { select: { zone: true }, orderBy: { zone: "asc" } },
        vehicles: { select: { id: true, registrationNumber: true, vehicleTypeCode: true } },
        _count: { select: { trips: true, payments: true } },
      },
    });
    if (!v) return null;
    const registered = primaryAddress(v.addresses, "REGISTERED") ?? primaryAddress(v.addresses, "BILLING");
    const addr = registered?.address;
    const bank = v.commercial?.bankAccount;
    const onboarding = await onboardingFields("VENDOR", id);
    const documents = await listDocuments("VENDOR", id);
    return {
      id: v.id,
      name: v.name,
      type: v.type,
      contactName: v.contactName,
      phone: v.phone,
      altPhone: v.altPhone,
      email: v.email,
      whatsapp: v.whatsapp,
      gstin: v.gstin,
      pan: v.pan,
      msme: v.msme,
      gstVerificationStatus: v.gstVerificationStatus,
      gstVerifiedAt: v.gstVerifiedAt,
      gstVerificationProvider: v.gstVerificationProvider,
      isActive: v.isActive,
      notes: v.notes,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      rating: v.rating ? n(v.rating) : null,
      addressLine1: addr?.line1 ?? null,
      addressLine2: addr?.line2 ?? null,
      city: addr?.city ?? null,
      state: addr?.state ?? null,
      pincode: addr?.pincode ?? null,
      paymentTerms: v.commercial?.paymentTermsDays ?? null,
      paymentTermsType: v.commercial?.paymentTermsType ?? null,
      bankName: bank?.bankName ?? null,
      bankAccount: bank?.accountNumber ?? null,
      bankIfsc: bank?.ifsc ?? null,
      bankBranch: bank?.branch ?? null,
      accountHolder: bank?.accountHolder ?? null,
      upiId: bank?.upiId ?? null,
      tdsApplicable: v.commercial?.tdsApplicable ?? false,
      deliveryZones: v.deliveryZones.map((z) => z.zone),
      vehicles: v.vehicles.map((vh) => vehicleDisplay(vh)),
      ...onboarding,
      counts: v._count,
      documents: mapDocs(documents),
    };
  });
}

export async function getVehicleDetail(id: string) {
  return safeRead("getVehicleDetail", null, async () => {
    const vh = await prisma.vehicle.findFirst({
      where: { id },
      include: {
        compliance: true,
        telematics: true,
        vendor: { select: { id: true, name: true } },
        _count: { select: { trips: true } },
      },
    });
    if (!vh) return null;
    const comp = vh.compliance;
    const tel = vh.telematics;
    const documents = await listDocuments("VEHICLE", id);
    return {
      id: vh.id,
      number: vh.registrationNumber,
      type: vh.vehicleTypeCode,
      bodyType: vh.bodyTypeCode,
      capacity: vh.capacityTons ? `${n(vh.capacityTons)} MT` : null,
      capacityTons: n(vh.capacityTons),
      make: vh.make,
      model: vh.model,
      year: vh.year,
      ownership: vh.ownership,
      remarks: vh.remarks,
      isActive: vh.isActive,
      vendor: vh.vendor,
      rcNumber: comp?.rcNumber ?? null,
      rcExpiry: comp?.rcExpiry ?? null,
      ownerName: comp?.ownerName ?? null,
      ownerPan: comp?.ownerPan ?? null,
      insuranceNumber: comp?.insuranceNumber ?? null,
      insuranceCompany: comp?.insuranceCompany ?? null,
      insuranceExpiry: comp?.insuranceExpiry ?? null,
      insuranceValue: n(comp?.insuranceValue),
      fitnessExpiry: comp?.fitnessExpiry ?? null,
      pucNumber: comp?.pucNumber ?? null,
      pucExpiry: comp?.pucExpiry ?? null,
      permitType: comp?.permitType ?? null,
      permitNumber: comp?.permitNumber ?? null,
      permitExpiry: comp?.permitExpiry ?? null,
      gpsEnabled: tel?.gpsEnabled ?? false,
      gpsDeviceId: tel?.gpsDeviceId ?? null,
      fastagId: tel?.fastagId ?? null,
      counts: vh._count,
      documents: mapDocs(documents),
    };
  });
}

export async function getDriverProfile(driverId: string) {
  return safeRead("getDriverProfile", null, async () => {
    const d = await prisma.driver.findFirst({ where: { id: driverId } });
    if (!d) return null;
    const onboarding = await onboardingFields("DRIVER", driverId);
    const documents = await listDocuments("DRIVER", driverId);
    return {
      id: d.id,
      name: d.name,
      phone: d.phone,
      dlNumber: d.dlNumber,
      dlExpiry: d.dlExpiry,
      deviceType: d.deviceType,
      otpVerified: d.otpVerified,
      accountStatus: d.accountStatus,
      address: d.address,
      city: d.city,
      state: d.state,
      pincode: d.pincode,
      ...onboarding,
      documents: mapDocs(documents),
    };
  });
}

export async function getOnboardingStatus(role: string, id: string) {
  return safeRead("getOnboardingStatus", null, async () => {
    const entityType = role as OnboardingEntityType;
    if (!["CLIENT", "VENDOR", "DRIVER", "VEHICLE"].includes(role)) return null;
    return onboardingFields(entityType, id);
  });
}

export async function getOnboardingQueue() {
  return safeRead("getOnboardingQueue", EMPTY_ONBOARDING_QUEUE, async () => {
    const items = await fetchOnboardingQueue();
    const driverIds = items.filter((i) => i.type === "driver").map((i) => i.id);
    const driverPhones =
      driverIds.length > 0
        ? await prisma.driver.findMany({
            where: { id: { in: driverIds } },
            select: { id: true, phone: true },
          })
        : [];
    const phoneById = new Map(driverPhones.map((d) => [d.id, d.phone]));

    const clients = items
      .filter((i) => i.type === "client")
      .map((i) => ({
        id: i.id,
        name: i.name,
        onboardingStatus: i.status,
        onboardingRemarks: i.remarks,
        createdAt: i.submittedAt ?? new Date(),
        createdByLabel: i.createdByLabel ?? null,
      }));
    const vendors = items
      .filter((i) => i.type === "vendor")
      .map((i) => ({
        id: i.id,
        name: i.name,
        onboardingStatus: i.status,
        onboardingRemarks: i.remarks,
        createdAt: i.submittedAt ?? new Date(),
      }));
    const drivers = items
      .filter((i) => i.type === "driver")
      .map((i) => ({
        id: i.id,
        name: i.name,
        phone: phoneById.get(i.id) ?? "",
        onboardingStatus: i.status,
        onboardingRemarks: i.remarks,
        createdAt: i.submittedAt ?? new Date(),
      }));
    const vehicles = items
      .filter((i) => i.type === "vehicle")
      .map((i) => ({
        id: i.id,
        name: i.name,
        onboardingStatus: i.status,
        onboardingRemarks: i.remarks,
        createdAt: i.submittedAt ?? new Date(),
      }));
    return { clients, vendors, drivers, vehicles };
  });
}

const ONBOARDING_SNAPSHOT_TYPES: Record<string, OnboardingEntityType> = {
  client: "CLIENT",
  vendor: "VENDOR",
  vehicle: "VEHICLE",
};

export async function getOnboardingApplicationSnapshot(type: string, id: string) {
  const entityType = ONBOARDING_SNAPSHOT_TYPES[type];
  if (!entityType) return null;

  return safeRead("getOnboardingApplicationSnapshot", null, async () => {
    const case_ = await getOnboardingCase(entityType, id);
    const reviewedBy = case_?.reviewedById
      ? await prisma.user.findFirst({
          where: { id: case_.reviewedById },
          select: { name: true, email: true },
        })
      : null;

    let entity:
      | NonNullable<Awaited<ReturnType<typeof getClientDetail>>>
      | NonNullable<Awaited<ReturnType<typeof getVendorDetail>>>
      | NonNullable<Awaited<ReturnType<typeof getVehicleDetail>>>
      | null = null;
    if (entityType === "CLIENT") entity = await getClientDetail(id);
    else if (entityType === "VENDOR") entity = await getVendorDetail(id);
    else if (entityType === "VEHICLE") entity = await getVehicleDetail(id);

    if (!entity) return null;

    const onboardingStatus =
      case_?.status ??
      ("onboardingStatus" in entity ? entity.onboardingStatus : "PENDING");
    const onboardingRemarks =
      case_?.remarks ??
      ("onboardingRemarks" in entity ? entity.onboardingRemarks : null);

    return {
      type,
      entity,
      submission: {
        status: onboardingStatus,
        remarks: onboardingRemarks,
        submittedAt: case_?.submittedAt ?? null,
        reviewedAt: case_?.reviewedAt ?? null,
        reviewedBy: reviewedBy?.name ?? reviewedBy?.email ?? null,
        createdAt: case_?.createdAt ?? null,
      },
    };
  });
}

// Trip context for the QR "capture on phone" page. Enforces ownership.
export async function getTripForCapture(
  user: { role?: string; vendorId?: string | null; driverId?: string | null },
  tripId: string
) {
  return safeRead("getTripForCapture", null, async () => {
    const t = await prisma.trip.findFirst({
      where: { id: tripId },
      select: {
        id: true,
        lrNumber: true,
        routeFrom: true,
        routeTo: true,
        vendorId: true,
        driverId: true,
        status: true,
        pods: { select: { status: true, resolutionStatus: true } },
      },
    });
    if (!t) return null;
    if (user.role === "VENDOR" && t.vendorId !== user.vendorId) return null;
    if (user.role === "DRIVER" && t.driverId !== user.driverId) return null;
    if (user.role === "CLIENT") return null;
    const { deriveTripPodQueueState } = await import("./pod-upload-eligibility");
    return {
      id: t.id,
      lrNumber: t.lrNumber,
      route: `${t.routeFrom} → ${t.routeTo}`,
      status: t.status,
      podState: deriveTripPodQueueState(t.pods ?? []),
    };
  });
}
