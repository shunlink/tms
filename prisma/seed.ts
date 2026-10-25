import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const now = new Date();

async function resetDatabase() {
  // Outbound payments + GL (before trips / notes)
  await prisma.paymentOutbox.deleteMany();
  await prisma.paymentAuditLog.deleteMany();
  await prisma.reconciliationRecord.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.paymentApproval.deleteMany();
  await prisma.outboundPayment.deleteMany();
  await prisma.vendorBeneficiary.deleteMany();
  await prisma.paymentWebhookEvent.deleteMany();

  await prisma.financialNoteEvent.deleteMany();
  await prisma.financialNoteLine.deleteMany();
  await prisma.financialNote.deleteMany();

  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();

  await prisma.vendorTripPayableAdjustment.deleteMany();
  await prisma.vendorTripPayable.deleteMany();
  await prisma.vendorBalancePaymentEvent.deleteMany();
  await prisma.vendorBalancePayment.deleteMany();
  await prisma.vendorBalancePaymentTask.deleteMany();
  await prisma.tripCharge.deleteMany();

  await prisma.invoiceTask.deleteMany();
  await prisma.clientInvoiceLine.deleteMany();
  await prisma.clientPayment.deleteMany();
  await prisma.clientInvoice.deleteMany();

  await prisma.slaTask.deleteMany();
  await prisma.userNotificationRead.deleteMany();

  await prisma.documentAttachment.deleteMany();
  await prisma.storedFile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.trackingPing.deleteMany();
  await prisma.importantEvent.deleteMany();
  await prisma.indentPod.deleteMany();
  await prisma.vendorPayment.deleteMany();
  await prisma.advanceRequestEvent.deleteMany();
  await prisma.advanceRequest.deleteMany();
  await prisma.indentPayment.deleteMany();
  await prisma.indentVendorRelease.deleteMany();
  await prisma.indentReleaseCity.deleteMany();
  await prisma.indentReleaseZone.deleteMany();
  await prisma.whatsAppInboundEvent.deleteMany();
  await prisma.whatsAppQuoteSession.deleteMany();
  await prisma.indentEwayBill.deleteMany();
  await prisma.indentAllocation.deleteMany();
  await prisma.vendorQuote.deleteMany();
  await prisma.indentLine.deleteMany();
  await prisma.indentClientFreight.deleteMany();
  await prisma.indentCargo.deleteMany();
  await prisma.indentUnloadingLocation.deleteMany();
  await prisma.indentLoadingLocation.deleteMany();
  await prisma.indentConsignment.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.indent.deleteMany();
}

async function main() {
  console.log("Resetting database...");
  await resetDatabase();
  await prisma.requirement.deleteMany();
  await prisma.vehicleTelematics.deleteMany();
  await prisma.vehicleCompliance.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clientCommercial.deleteMany();
  await prisma.clientAddress.deleteMany();
  await prisma.vendorDeliveryZone.deleteMany();
  await prisma.vendorCommercial.deleteMany();
  await prisma.vendorAddress.deleteMany();
  await prisma.onboardingCase.deleteMany();
  await prisma.client.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.address.deleteMany();
  await prisma.idSequence.deleteMany();
  await prisma.lookupCatalog.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.team.deleteMany();

  console.log("Seeding lookups...");
  await prisma.lookupCatalog.createMany({
    data: [
      { category: "SERVICE_TYPE", code: "GTA", label: "Goods Transport Agency" },
      { category: "TRANSACTION_TYPE", code: "SPOT", label: "Spot Booking" },
      { category: "TRANSACTION_TYPE", code: "CONTRACT", label: "Contract" },
      { category: "INSURANCE_TYPE", code: "NONE", label: "No Insurance" },
      { category: "INSURANCE_TYPE", code: "TRANSIT", label: "Transit Insurance" },
      { category: "CARGO_TYPE", code: "STEEL", label: "Steel" },
      { category: "CARGO_TYPE", code: "GENERAL", label: "General Cargo" },
      { category: "CARGO_TYPE", code: "FMCG", label: "FMCG" },
      { category: "CARGO_TYPE", code: "AUTO", label: "Auto Components" },
      { category: "VEHICLE_TYPE", code: "TRUCK_17FT", label: "17 ft Truck" },
      { category: "VEHICLE_TYPE", code: "TRUCK_20FT", label: "20 ft Truck" },
      { category: "VEHICLE_TYPE", code: "TRUCK_32FT_MULTI", label: "32 ft Multi-axle" },
      { category: "VEHICLE_TYPE", code: "CONTAINER_20FT", label: "20 ft Container" },
      { category: "BODY_TYPE", code: "OPEN", label: "Open Body" },
      { category: "BODY_TYPE", code: "CLOSED", label: "Closed Body" },
    ],
  });

  console.log("Seeding sequences...");
  const year = now.getFullYear();
  await prisma.idSequence.createMany({
    data: [
      { prefix: "indent", year, lastValue: 0 },
      { prefix: "lr", year, lastValue: 0 },
      { prefix: "invoice", year, lastValue: 0 },
      { prefix: "requirement", year, lastValue: 0 },
      { prefix: "advance_voucher", year, lastValue: 0 },
      { prefix: "debit_note", year, lastValue: 0 },
      { prefix: "credit_note", year, lastValue: 0 },
      { prefix: "journal", year, lastValue: 0 },
    ],
  });

  console.log("Seeding teams...");
  const { ensureDefaultTeams } = await import("../src/lib/services/employee.service");
  await ensureDefaultTeams();
  const teams = await prisma.team.findMany();
  const teamByCode = new Map(teams.map((t) => [t.code, t.id]));

  console.log("Seeding permissions + role permissions...");
  const { ensurePermissions } = await import("../src/lib/services/permission.service");
  await ensurePermissions();

  const password = await bcrypt.hash("admin123", 10);

  console.log("Seeding internal staff...");
  await prisma.user.create({
    data: {
      email: "admin@tms.local",
      name: "Super Admin",
      password,
      role: "SUPER_ADMIN",
      teamId: teamByCode.get("ADMIN"),
      employeeCode: "EMP001",
      jobTitle: "Super Administrator",
    },
  });
  await prisma.user.create({
    data: {
      email: "manager@tms.local",
      name: "Admin Manager",
      password,
      role: "ADMIN",
      teamId: teamByCode.get("ADMIN"),
      employeeCode: "EMP002",
      jobTitle: "Admin Manager",
    },
  });
  await prisma.user.create({
    data: {
      email: "sales@tms.local",
      name: "Sales User",
      password,
      role: "SALES",
      teamId: teamByCode.get("SALES"),
      employeeCode: "EMP003",
      jobTitle: "Sales Executive",
    },
  });
  await prisma.user.create({
    data: {
      email: "ops@tms.local",
      name: "Ops Manager",
      password,
      role: "OPERATIONS",
      teamId: teamByCode.get("OPERATIONS"),
      employeeCode: "EMP004",
      jobTitle: "Operations Manager",
    },
  });
  await prisma.user.create({
    data: {
      email: "finance@tms.local",
      name: "Finance User",
      password,
      role: "FINANCE",
      teamId: teamByCode.get("FINANCE"),
      employeeCode: "EMP005",
      jobTitle: "Finance Analyst",
    },
  });
  const { seedDemoPartners } = await import("./seed-demo-partners");
  await seedDemoPartners(prisma, password);

  console.log("Seeding demo vehicle/driver...");
  const driver = await prisma.driver.create({
    data: { name: "Ravi Kumar", phone: "9999999999", dlNumber: "MH0123456789", deviceType: "SMARTPHONE", city: "Mumbai", accountStatus: "ACTIVE" },
  });
  await prisma.user.create({
    data: { name: "Ravi Kumar", password, role: "DRIVER", driverId: driver.id, email: null, phone: null },
  });

  console.log("Seeding accounting foundation (chart + periods)...");
  const { ensureChartOfAccounts } = await import("../src/lib/accounting/chart-of-accounts.service");
  const { ensureDefaultAccountingPeriods } = await import(
    "../src/lib/accounting/accounting-period.service"
  );
  await ensureChartOfAccounts();
  await ensureDefaultAccountingPeriods();

  console.log("Seed complete.");
  console.log("Super Admin: admin@tms.local / admin123");
  console.log("Admin:       manager@tms.local / admin123");
  console.log("Sales:       sales@tms.local / admin123");
  console.log("Operations:  ops@tms.local / admin123");
  console.log("Finance:     finance@tms.local / admin123");
  console.log("Clients:     client01@demo.local … client10@demo.local / admin123");
  console.log("             (client10 onboarding PENDING_APPROVAL for queue testing)");
  console.log("Vendors:     vendor01@demo.local … vendor10@demo.local / admin123");
  console.log("             (vendor10 onboarding PENDING_APPROVAL for queue testing)");
  console.log("Driver:      DL MH0123456789 (OTP login)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
