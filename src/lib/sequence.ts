import { prisma } from "./prisma";

const PREFIX_MAP: Record<string, string> = {
  IND: "indent",
  LR: "lr",
  INV: "invoice",
  REQ: "requirement",
  ADV: "advance_request",
  APV: "advance_voucher",
  JRN: "journal",
  DBN: "debit_note",
  CRN: "credit_note",
};

/**
 * Atomic sequence via upsert (INSERT … ON CONFLICT DO UPDATE — no read-then-write race).
 * Single-company: unique on (prefix, year).
 */
export async function nextNumber(prefix: string) {
  const year = new Date().getFullYear();
  const key = PREFIX_MAP[prefix] ?? prefix.toLowerCase();

  const row = await prisma.idSequence.upsert({
    where: { prefix_year: { prefix: key, year } },
    create: { prefix: key, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });

  return `${prefix}-${year}-${String(row.lastValue).padStart(4, "0")}`;
}
