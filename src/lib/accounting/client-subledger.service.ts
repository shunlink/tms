import { prisma } from "../prisma";
import { invoiceOutstanding } from "../invoice-payment";
import { sumPostedOnAccount } from "./gl-balances.service";
import { CONTROL_ACCOUNT_CODES } from "./control-accounts";

export type ClientSubledgerDocumentType =
  | "INVOICE"
  | "INVOICE_ADJUSTMENT"
  | "FINANCIAL_NOTE"
  | "CLIENT_PAYMENT"
  | "OPENING_BALANCE"
  | "GL_POSTING";

export type ClientSubledgerLine = {
  id: string;
  effectiveDate: Date;
  documentType: ClientSubledgerDocumentType;
  reference: string;
  description: string;
  invoiceId: string | null;
  indentId: string | null;
  tripId: string | null;
  debitMinor: number;
  creditMinor: number;
  runningBalanceMinor: number;
  sourceType: string;
  sourceId: string;
  journalEntryId: string | null;
  journalNumber: string | null;
  postingLayer: "OPERATIONAL" | "POSTED_GL";
  allocationStatus: "ALLOCATED" | "UNALLOCATED" | null;
};

export type ClientStatement = {
  clientId: string;
  clientName: string;
  currency: string;
  fromDate: Date | null;
  toDate: Date | null;
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  lines: ClientSubledgerLine[];
  operationalReceivablesMinor: number;
  unallocatedReceiptsMinor: number;
  glReceivablesBalanceMinor: number;
};

function rupeesToMinor(n: number): number {
  return Math.round(n * 100);
}

function inDateRange(d: Date, from?: Date | null, to?: Date | null): boolean {
  const t = d.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

function applyRunningBalance(lines: ClientSubledgerLine[], openingMinor: number): ClientSubledgerLine[] {
  let bal = openingMinor;
  return lines.map((line) => {
    bal += line.debitMinor - line.creditMinor;
    return { ...line, runningBalanceMinor: bal };
  });
}

async function openingBalanceMinorBefore(clientId: string, beforeDate: Date | null): Promise<number> {
  if (!beforeDate) return 0;
  const lines = await collectClientLines({ clientId });
  const prior = lines.filter((l) => l.effectiveDate < beforeDate);
  return prior.reduce((s, l) => s + l.debitMinor - l.creditMinor, 0);
}

async function collectClientLines(input: {
  clientId: string;
  invoiceId?: string;
  indentId?: string;
  tripId?: string;
  documentType?: ClientSubledgerDocumentType;
  reference?: string;
}): Promise<ClientSubledgerLine[]> {
  const clientId = input.clientId;
  const lines: ClientSubledgerLine[] = [];

  const invoices = await prisma.clientInvoice.findMany({
    where: {
      clientId,
      status: { notIn: ["DRAFT", "CANCELLED"] },
      ...(input.invoiceId ? { id: input.invoiceId } : {}),
    },
    include: { lines: { select: { tripId: true, indentNumber: true } } },
  });

  for (const inv of invoices) {
    const effective = inv.finalizedAt ?? inv.issueDate;
    const totalMinor = rupeesToMinor(Number(inv.totalAmount));
    const tripId = inv.lines[0]?.tripId ?? null;
    lines.push({
      id: `inv:${inv.id}`,
      effectiveDate: effective,
      documentType: "INVOICE",
      reference: inv.invoiceNumber,
      description: `Invoice issued — ${inv.status}`,
      invoiceId: inv.id,
      indentId: null,
      tripId,
      debitMinor: totalMinor,
      creditMinor: 0,
      runningBalanceMinor: 0,
      sourceType: "ClientInvoice",
      sourceId: inv.id,
      journalEntryId: null,
      journalNumber: null,
      postingLayer: "OPERATIONAL",
      allocationStatus: null,
    });
  }

  const notes = await prisma.financialNote.findMany({
    where: {
      clientId,
      counterpartyType: "CLIENT",
      status: "ISSUED",
      ...(input.invoiceId ? { clientInvoiceId: input.invoiceId } : {}),
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.indentId ? { indentId: input.indentId } : {}),
    },
    include: { issuedJournal: { select: { id: true, journalNumber: true } } },
  });

  for (const note of notes) {
    const issuedAt = note.issuedAt ?? note.issueDate ?? note.accountingDate ?? note.updatedAt;
    const totalMinor = rupeesToMinor(Number(note.totalAmount));
    const isReduction =
      note.businessPurpose.includes("REDUCTION") || note.noteType === "CREDIT_NOTE";
    lines.push({
      id: `note:${note.id}`,
      effectiveDate: issuedAt,
      documentType: "FINANCIAL_NOTE",
      reference: note.noteNumber ?? note.id,
      description: note.description ?? `${note.noteType} — ${note.businessPurpose}`,
      invoiceId: note.clientInvoiceId,
      indentId: note.indentId,
      tripId: note.tripId,
      debitMinor: isReduction ? 0 : totalMinor,
      creditMinor: isReduction ? totalMinor : 0,
      runningBalanceMinor: 0,
      sourceType: "FinancialNote",
      sourceId: note.id,
      journalEntryId: note.issuedJournalId,
      journalNumber: note.issuedJournal?.journalNumber ?? null,
      postingLayer: note.issuedJournalId ? "POSTED_GL" : "OPERATIONAL",
      allocationStatus: null,
    });
  }

  const payments = await prisma.clientPayment.findMany({
    where: {
      clientId,
      ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.indentId ? { indentId: input.indentId } : {}),
    },
  });

  for (const pay of payments) {
    const amountMinor = rupeesToMinor(Number(pay.amount));
    lines.push({
      id: `cp:${pay.id}`,
      effectiveDate: pay.paidAt,
      documentType: "CLIENT_PAYMENT",
      reference: pay.referenceNo ?? pay.id,
      description: `${pay.paymentType} receipt${pay.paymentMode ? ` (${pay.paymentMode})` : ""}`,
      invoiceId: pay.invoiceId,
      indentId: pay.indentId,
      tripId: pay.tripId,
      debitMinor: 0,
      creditMinor: amountMinor,
      runningBalanceMinor: 0,
      sourceType: "ClientPayment",
      sourceId: pay.id,
      journalEntryId: null,
      journalNumber: null,
      postingLayer: "OPERATIONAL",
      allocationStatus: pay.invoiceId ? "ALLOCATED" : "UNALLOCATED",
    });
  }

  const glLines = await prisma.journalLine.findMany({
    where: {
      clientId,
      journalEntry: { status: "POSTED" },
      account: { code: CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE },
    },
    include: {
      journalEntry: {
        select: { id: true, journalNumber: true, accountingDate: true, sourceType: true, sourceId: true },
      },
    },
  });

  for (const gl of glLines) {
    if (gl.journalEntry.sourceType === "FINANCIAL_NOTE") continue;
    lines.push({
      id: `gl:${gl.id}`,
      effectiveDate: gl.journalEntry.accountingDate,
      documentType:
        gl.journalEntry.sourceType === "OPENING_BALANCE" ? "OPENING_BALANCE" : "GL_POSTING",
      reference: gl.journalEntry.journalNumber,
      description: gl.description ?? "Accounts receivable GL",
      invoiceId: null,
      indentId: gl.indentId,
      tripId: gl.tripId,
      debitMinor: gl.debitMinor,
      creditMinor: gl.creditMinor,
      runningBalanceMinor: 0,
      sourceType: gl.journalEntry.sourceType,
      sourceId: gl.journalEntry.sourceId ?? gl.journalEntry.id,
      journalEntryId: gl.journalEntry.id,
      journalNumber: gl.journalEntry.journalNumber,
      postingLayer: "POSTED_GL",
      allocationStatus: null,
    });
  }

  let filtered = lines;
  if (input.documentType) filtered = filtered.filter((l) => l.documentType === input.documentType);
  if (input.reference) {
    const q = input.reference.toLowerCase();
    filtered = filtered.filter((l) => l.reference.toLowerCase().includes(q));
  }

  filtered.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
  return filtered;
}

export async function buildClientStatement(input: {
  clientId: string;
  fromDate?: Date;
  toDate?: Date;
  invoiceId?: string;
  indentId?: string;
  tripId?: string;
  documentType?: ClientSubledgerDocumentType;
  reference?: string;
  currency?: string;
}): Promise<ClientStatement | null> {
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true, name: true },
  });
  if (!client) return null;

  const currency = input.currency ?? "INR";
  const allLines = await collectClientLines({
    clientId: input.clientId,
    invoiceId: input.invoiceId,
    indentId: input.indentId,
    tripId: input.tripId,
    documentType: input.documentType,
    reference: input.reference,
  });

  const opening = await openingBalanceMinorBefore(input.clientId, input.fromDate ?? null);
  const ranged = allLines.filter((l) => inDateRange(l.effectiveDate, input.fromDate, input.toDate));
  const withRunning = applyRunningBalance(ranged, opening);

  const invoices = await prisma.clientInvoice.findMany({
    where: { clientId: input.clientId, status: { notIn: ["DRAFT", "CANCELLED"] } },
    select: { totalAmount: true, paidAmount: true },
  });
  const operationalReceivables = invoices.reduce(
    (s, inv) => s + invoiceOutstanding(Number(inv.totalAmount), Number(inv.paidAmount)),
    0
  );

  const unallocatedPayments = await prisma.clientPayment.findMany({
    where: { clientId: input.clientId, invoiceId: null },
    select: { amount: true },
  });
  const unallocatedReceipts = unallocatedPayments.reduce((s, p) => s + Number(p.amount), 0);

  const glReceivables = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, {
    asOfDate: input.toDate ?? new Date(),
    clientId: input.clientId,
    currency,
  });

  const closing =
    withRunning.length > 0
      ? withRunning[withRunning.length - 1].runningBalanceMinor
      : opening;

  return {
    clientId: client.id,
    clientName: client.name,
    currency,
    fromDate: input.fromDate ?? null,
    toDate: input.toDate ?? null,
    openingBalanceMinor: opening,
    closingBalanceMinor: closing,
    lines: withRunning,
    operationalReceivablesMinor: rupeesToMinor(operationalReceivables),
    unallocatedReceiptsMinor: rupeesToMinor(unallocatedReceipts),
    glReceivablesBalanceMinor: glReceivables.signedMinor,
  };
}

export async function listClientSubledgerSummaries(input?: { limit?: number; offset?: number }) {
  const limit = Math.min(input?.limit ?? 50, 200);
  const offset = input?.offset ?? 0;
  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: limit,
    skip: offset,
  });
  const total = await prisma.client.count();

  const summaries = await Promise.all(
    clients.map(async (c) => {
      const invoices = await prisma.clientInvoice.findMany({
        where: { clientId: c.id, status: { notIn: ["DRAFT", "CANCELLED"] } },
        select: { totalAmount: true, paidAmount: true },
      });
      const operational = invoices.reduce(
        (s, inv) => s + invoiceOutstanding(Number(inv.totalAmount), Number(inv.paidAmount)),
        0
      );
      const gl = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, {
        asOfDate: new Date(),
        clientId: c.id,
      });
      return {
        clientId: c.id,
        clientName: c.name,
        operationalReceivablesMinor: rupeesToMinor(operational),
        glReceivablesBalanceMinor: gl.signedMinor,
      };
    })
  );

  return { items: summaries, total, limit, offset };
}
