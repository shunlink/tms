import type { PrismaClient } from "@prisma/client";
import { ONBOARDING_CASE_STATUS } from "../src/lib/onboarding-case-status";
import { updateClientProfile, updateVendorProfile } from "../src/lib/services/profile.service";

const DEMO_CLIENTS = [
  { slug: "01", name: "Tata Steel Ltd", businessType: "PRIVATE_LIMITED", industry: "Steel", city: "Jamshedpur", state: "Jharkhand", gst: "20AAAAA0000A1Z5" },
  { slug: "02", name: "Reliance Retail Logistics", businessType: "PRIVATE_LIMITED", industry: "FMCG", city: "Mumbai", state: "Maharashtra", gst: "27AAAAA0000A2Z5" },
  { slug: "03", name: "Mahindra Auto Components", businessType: "PRIVATE_LIMITED", industry: "Automotive", city: "Pune", state: "Maharashtra", gst: "27AAAAA0000A3Z5" },
  { slug: "04", name: "ITC Agri Business", businessType: "PUBLIC_LIMITED", industry: "Agriculture", city: "Kolkata", state: "West Bengal", gst: "19AAAAA0000A4Z5" },
  { slug: "05", name: "Asian Paints Distribution", businessType: "PRIVATE_LIMITED", industry: "Chemicals", city: "Mumbai", state: "Maharashtra", gst: "27AAAAA0000A5Z5" },
  { slug: "06", name: "Hindalco Industries", businessType: "PUBLIC_LIMITED", industry: "Metals", city: "Mumbai", state: "Maharashtra", gst: "27AAAAA0000A6Z5" },
  { slug: "07", name: "Dabur India Ltd", businessType: "PUBLIC_LIMITED", industry: "FMCG", city: "Ghaziabad", state: "Uttar Pradesh", gst: "09AAAAA0000A7Z5" },
  { slug: "08", name: "Bharat Forge", businessType: "PUBLIC_LIMITED", industry: "Manufacturing", city: "Pune", state: "Maharashtra", gst: "27AAAAA0000A8Z5" },
  { slug: "09", name: "Nestlé India", businessType: "PRIVATE_LIMITED", industry: "FMCG", city: "Gurgaon", state: "Haryana", gst: "06AAAAA0000A9Z5" },
  { slug: "10", name: "UltraTech Cement", businessType: "PUBLIC_LIMITED", industry: "Cement", city: "Mumbai", state: "Maharashtra", gst: "27AAAAA0000B1Z5" },
] as const;

const DEMO_VENDORS = [
  { slug: "01", name: "Sharma Transport", type: "FLEET_OWNER" as const, city: "Pune", state: "Maharashtra", gst: "27BBBBB0000B1Z5", paymentTermsType: "CREDIT" as const, zones: ["WEST", "SOUTH"] },
  { slug: "02", name: "Gupta Roadlines", type: "FLEET_OWNER" as const, city: "Delhi", state: "Delhi", gst: "07BBBBB0000B2Z5", paymentTermsType: "ADHOC" as const, zones: ["NORTH"] },
  { slug: "03", name: "Patel Logistics", type: "BROKER" as const, city: "Ahmedabad", state: "Gujarat", gst: "24BBBBB0000B3Z5", paymentTermsType: "CREDIT" as const, zones: ["WEST", "NORTH"] },
  { slug: "04", name: "Reddy Fleet Services", type: "FLEET_OWNER" as const, city: "Hyderabad", state: "Telangana", gst: "36BBBBB0000B4Z5", paymentTermsType: "CREDIT" as const, zones: ["SOUTH"] },
  { slug: "05", name: "Singh Cargo Movers", type: "FLEET_OWNER" as const, city: "Ludhiana", state: "Punjab", gst: "03BBBBB0000B5Z5", paymentTermsType: "ADHOC" as const, zones: ["NORTH", "WEST"] },
  { slug: "06", name: "Kumar Express Carriers", type: "FLEET_OWNER" as const, city: "Chennai", state: "Tamil Nadu", gst: "33BBBBB0000B6Z5", paymentTermsType: "CREDIT" as const, zones: ["SOUTH", "EAST"] },
  { slug: "07", name: "Iyer Transport Co", type: "BROKER" as const, city: "Bengaluru", state: "Karnataka", gst: "29BBBBB0000B7Z5", paymentTermsType: "ADHOC" as const, zones: ["SOUTH"] },
  { slug: "08", name: "Das Highway Logistics", type: "FLEET_OWNER" as const, city: "Kolkata", state: "West Bengal", gst: "19BBBBB0000B8Z5", paymentTermsType: "CREDIT" as const, zones: ["EAST", "NORTH"] },
  { slug: "09", name: "Mehta Fleet Solutions", type: "FLEET_OWNER" as const, city: "Indore", state: "Madhya Pradesh", gst: "23BBBBB0000B9Z5", paymentTermsType: "CREDIT" as const, zones: ["WEST", "NORTH"] },
  { slug: "10", name: "Nair Road Transport", type: "FLEET_OWNER" as const, city: "Kochi", state: "Kerala", gst: "32BBBBB0000C1Z5", paymentTermsType: "ADHOC" as const, zones: ["SOUTH"] },
] as const;

function panFromGst(gst: string) {
  return gst.slice(2, 12);
}

function phoneForIndex(prefix: "client" | "vendor", idx: number) {
  const base = prefix === "client" ? 981_000_0000 : 982_000_0000;
  return String(base + idx);
}

export async function seedDemoPartners(prisma: PrismaClient, passwordHash: string) {
  console.log("Seeding demo partners (10 clients + 10 vendors)...");

  for (let i = 0; i < DEMO_CLIENTS.length; i++) {
    const row = DEMO_CLIENTS[i];
    const idx = i + 1;
    const email = `client${row.slug}@demo.local`;
    const contact = `Client Contact ${idx}`;
    const phone = phoneForIndex("client", idx);

    const client = await prisma.client.create({
      data: {
        name: row.name,
        legalName: row.name,
        businessType: row.businessType,
        industry: row.industry,
        contactName: contact,
        phone,
        email,
        gstin: row.gst,
        pan: panFromGst(row.gst),
      },
    });

    await updateClientProfile(client.id, {
      name: row.name,
      businessType: row.businessType,
      industry: row.industry,
      contactName: contact,
      phone,
      email,
      gstin: row.gst,
      pan: panFromGst(row.gst),
      addressLine1: `${idx} Industrial Area`,
      city: row.city,
      state: row.state,
      pincode: "400001",
      country: "India",
      bankName: "HDFC Bank",
      bankAccount: `50100${String(idx).padStart(6, "0")}`,
      bankIfsc: "HDFC0001234",
      bankBranch: "Main Branch",
      accountHolder: row.name,
      creditLimit: 500000 * idx,
      paymentTerms: 30,
      securityDeposit: 10000 * idx,
    });

    const onboardingStatus =
      idx === 10 ? ONBOARDING_CASE_STATUS.PENDING_APPROVAL : ONBOARDING_CASE_STATUS.APPROVED;

    await prisma.onboardingCase.create({
      data: {
        entityType: "CLIENT",
        entityId: client.id,
        status: onboardingStatus,
        ...(onboardingStatus === ONBOARDING_CASE_STATUS.APPROVED
          ? { reviewedAt: new Date() }
          : {}),
      },
    });

    await prisma.user.create({
      data: {
        email,
        name: contact,
        password: passwordHash,
        role: "CLIENT",
        clientId: client.id,
        phone,
      },
    });
  }

  for (let i = 0; i < DEMO_VENDORS.length; i++) {
    const row = DEMO_VENDORS[i];
    const idx = i + 1;
    const email = `vendor${row.slug}@demo.local`;
    const contact = `Vendor Contact ${idx}`;
    const phone = phoneForIndex("vendor", idx);

    const vendor = await prisma.vendor.create({
      data: {
        name: row.name,
        type: row.type,
        contactName: contact,
        phone,
        whatsapp: phone,
        email,
        gstin: row.gst,
        pan: panFromGst(row.gst),
      },
    });

    await updateVendorProfile(vendor.id, {
      name: row.name,
      type: row.type,
      contactName: contact,
      phone,
      whatsapp: phone,
      email,
      gstin: row.gst,
      pan: panFromGst(row.gst),
      addressLine1: `${idx} Transport Nagar`,
      city: row.city,
      state: row.state,
      pincode: "411001",
      bankName: "ICICI Bank",
      bankAccount: `60200${String(idx).padStart(6, "0")}`,
      bankIfsc: "ICIC0001234",
      bankBranch: "City Branch",
      accountHolder: row.name,
      paymentTermsType: row.paymentTermsType,
      paymentTerms: row.paymentTermsType === "CREDIT" ? 15 : null,
      deliveryZones: [...row.zones],
    });

    const onboardingStatus =
      idx === 10 ? ONBOARDING_CASE_STATUS.PENDING_APPROVAL : ONBOARDING_CASE_STATUS.APPROVED;

    await prisma.onboardingCase.create({
      data: {
        entityType: "VENDOR",
        entityId: vendor.id,
        status: onboardingStatus,
        ...(onboardingStatus === ONBOARDING_CASE_STATUS.APPROVED
          ? { reviewedAt: new Date() }
          : {}),
      },
    });

    await prisma.user.create({
      data: {
        email,
        name: contact,
        password: passwordHash,
        role: "VENDOR",
        vendorId: vendor.id,
        phone,
      },
    });
  }

  const firstClient = await prisma.client.findFirst({ where: { name: DEMO_CLIENTS[0].name } });
  const firstVendor = await prisma.vendor.findFirst({ where: { name: DEMO_VENDORS[0].name } });
  return { firstClientId: firstClient?.id, firstVendorId: firstVendor?.id };
}
