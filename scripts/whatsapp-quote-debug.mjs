import { loadEnv } from "./load-env.mjs";
import { PrismaClient } from "@prisma/client";

loadEnv();
const prisma = new PrismaClient();

const indentNumber = process.argv[2] ?? "IND-2026-0009";

const indent = await prisma.indent.findFirst({
  where: { indentNumber },
  include: {
    quotes: { include: { vendor: { select: { name: true, phone: true, whatsapp: true } } } },
    releaseCities: true,
  },
});

if (!indent) {
  console.log(`Indent ${indentNumber} not found`);
  process.exit(1);
}

const sessions = await prisma.whatsAppQuoteSession.findMany({
  where: { indentId: indent.id },
  include: { vendor: { select: { name: true, whatsapp: true, phone: true } } },
});

const inbound = await prisma.whatsAppInboundEvent.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
});

console.log(`\nIndent: ${indent.indentNumber} (${indent.id}) status=${indent.status}`);
console.log("Quotes:", indent.quotes.length);
for (const q of indent.quotes) {
  console.log(`  - ${q.vendor.name} rate=${q.quotedRate} channel=${q.channel}`);
}
const releases = await prisma.indentVendorRelease.findMany({
  where: { indentId: indent.id },
  include: { vendor: { select: { name: true, whatsapp: true, phone: true } } },
});
console.log("Released vendors:");
for (const r of releases) {
  console.log(`  - ${r.vendor.name} wa=${r.vendor.whatsapp ?? r.vendor.phone}`);
}
console.log("Quote sessions:");
for (const s of sessions) {
  console.log(`  - ${s.vendor.name} status=${s.status}`);
}
console.log("\nRecent inbound webhooks:");
for (const e of inbound) {
  console.log(`  - ${e.createdAt.toISOString()} msg=${e.messageId} result=${e.result ?? "—"}`);
}

await prisma.$disconnect();
