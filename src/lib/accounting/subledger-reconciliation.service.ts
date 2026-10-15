import { prisma } from "../prisma";
import { computeOutstandingVendorPayables } from "../services/vendor-payables.service";
import { invoiceOutstanding } from "../invoice-payment";
import { aggregatePostedBalancesByAccount, sumPostedOnAccount } from "./gl-balances.service";
import { CONTROL_ACCOUNT_CODES } from "./control-accounts";

export type SubledgerReconciliationRow = {
  controlAccountCode: string;
  controlAccountName: string;
  subledgerLabel: string;
  subledgerTotalMinor: number;
  glControlBalanceMinor: number;
  differenceMinor: number;
  limitation: string | null;
  details: { entityId: string; entityName: string; subledgerMinor: number; glMinor: number }[];
};

export type SubledgerReconciliationReport = {
  asOfDate: string;
  currency: string;
  generatedAt: string;
  rows: SubledgerReconciliationRow[];
};

function rupeesToMinor(n: number): number {
  return Math.round(n * 100);
}

export async function buildSubledgerReconciliationReport(input: {
  asOfDate: Date;
  currency?: string;
  vendorId?: string;
  clientId?: string;
}): Promise<SubledgerReconciliationReport> {
  const currency = input.currency ?? "INR";
  const filter = { asOfDate: input.asOfDate, currency };

  const vendorPayableGl = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES, {
    ...filter,
    vendorId: input.vendorId,
  });

  let vendorSubledgerTotal = 0;
  const vendorDetails: SubledgerReconciliationRow["details"] = [];

  if (input.vendorId) {
    vendorSubledgerTotal = rupeesToMinor(await computeOutstandingVendorPayables(input.vendorId));
    const vendor = await prisma.vendor.findUnique({
      where: { id: input.vendorId },
      select: { name: true },
    });
    vendorDetails.push({
      entityId: input.vendorId,
      entityName: vendor?.name ?? input.vendorId,
      subledgerMinor: vendorSubledgerTotal,
      glMinor: vendorPayableGl.signedMinor,
    });
  } else {
    const vendors = await prisma.vendor.findMany({ select: { id: true, name: true } });
    for (const v of vendors) {
      const subMinor = rupeesToMinor(await computeOutstandingVendorPayables(v.id));
      const gl = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES, {
        ...filter,
        vendorId: v.id,
      });
      vendorSubledgerTotal += subMinor;
      if (subMinor !== 0 || gl.signedMinor !== 0) {
        vendorDetails.push({
          entityId: v.id,
          entityName: v.name,
          subledgerMinor: subMinor,
          glMinor: gl.signedMinor,
        });
      }
    }
  }

  const payableAccount = await prisma.chartOfAccount.findUnique({
    where: { code: CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES },
  });

  const arGl = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, {
    ...filter,
    clientId: input.clientId,
  });

  let arSubledgerTotal = 0;
  const clientDetails: SubledgerReconciliationRow["details"] = [];

  if (input.clientId) {
    const invoices = await prisma.clientInvoice.findMany({
      where: { clientId: input.clientId, status: { notIn: ["DRAFT", "CANCELLED"] } },
      select: { totalAmount: true, paidAmount: true },
    });
    arSubledgerTotal = rupeesToMinor(
      invoices.reduce(
        (s, inv) => s + invoiceOutstanding(Number(inv.totalAmount), Number(inv.paidAmount)),
        0
      )
    );
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      select: { name: true },
    });
    clientDetails.push({
      entityId: input.clientId,
      entityName: client?.name ?? input.clientId,
      subledgerMinor: arSubledgerTotal,
      glMinor: arGl.signedMinor,
    });
  } else {
    const clients = await prisma.client.findMany({ select: { id: true, name: true } });
    for (const c of clients) {
      const invoices = await prisma.clientInvoice.findMany({
        where: { clientId: c.id, status: { notIn: ["DRAFT", "CANCELLED"] } },
        select: { totalAmount: true, paidAmount: true },
      });
      const subMinor = rupeesToMinor(
        invoices.reduce(
          (s, inv) => s + invoiceOutstanding(Number(inv.totalAmount), Number(inv.paidAmount)),
          0
        )
      );
      const gl = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, {
        ...filter,
        clientId: c.id,
      });
      arSubledgerTotal += subMinor;
      if (subMinor !== 0 || gl.signedMinor !== 0) {
        clientDetails.push({
          entityId: c.id,
          entityName: c.name,
          subledgerMinor: subMinor,
          glMinor: gl.signedMinor,
        });
      }
    }
  }

  const arAccount = await prisma.chartOfAccount.findUnique({
    where: { code: CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE },
  });

  const advanceGlAgg = await aggregatePostedBalancesByAccount({
    ...filter,
    accountCodes: [CONTROL_ACCOUNT_CODES.VENDOR_ADVANCES],
  });
  const advanceGlMinor =
    advanceGlAgg.find((a) => a.code === CONTROL_ACCOUNT_CODES.VENDOR_ADVANCES)?.debitMinor !== undefined
      ? (await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.VENDOR_ADVANCES, filter)).signedMinor
      : 0;

  const advanceAccount = await prisma.chartOfAccount.findUnique({
    where: { code: CONTROL_ACCOUNT_CODES.VENDOR_ADVANCES },
  });

  const bankGl = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.BANK_CASH, filter);
  const bankAccount = await prisma.chartOfAccount.findUnique({
    where: { code: CONTROL_ACCOUNT_CODES.BANK_CASH },
  });
  const unmatchedBankMinor = await prisma.bankStatementLine.aggregate({
    where: { glAccountCode: CONTROL_ACCOUNT_CODES.BANK_CASH, reconStatus: "UNMATCHED" },
    _sum: { amountMinor: true },
  });
  const bankSubledgerMinor = bankGl.signedMinor;

  const clearingGl = await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.GATEWAY_CLEARING, filter);
  const clearingAccount = await prisma.chartOfAccount.findUnique({
    where: { code: CONTROL_ACCOUNT_CODES.GATEWAY_CLEARING },
  });
  const gatewayOpen = await prisma.reconciliationRecord.count({
    where: { status: { in: ["OPEN", "MISMATCH", "UNMATCHED"] } },
  });

  const rows: SubledgerReconciliationRow[] = [
    {
      controlAccountCode: CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES,
      controlAccountName: payableAccount?.name ?? "Vendor Payables",
      subledgerLabel: "Authoritative vendor trip payables (operational)",
      subledgerTotalMinor: vendorSubledgerTotal,
      glControlBalanceMinor: input.vendorId
        ? vendorPayableGl.signedMinor
        : (await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES, filter)).signedMinor,
      differenceMinor:
        vendorSubledgerTotal -
        (input.vendorId
          ? vendorPayableGl.signedMinor
          : (await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.VENDOR_PAYABLES, filter)).signedMinor),
      limitation:
        "Compares operational outstanding payables to posted 2110 vendor lines; timing and unmigrated history may differ.",
      details: vendorDetails.filter((d) => d.subledgerMinor !== d.glMinor),
    },
    {
      controlAccountCode: CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      controlAccountName: arAccount?.name ?? "Accounts Receivable",
      subledgerLabel: "Client invoice outstanding (operational)",
      subledgerTotalMinor: arSubledgerTotal,
      glControlBalanceMinor: input.clientId
        ? arGl.signedMinor
        : (await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, filter)).signedMinor,
      differenceMinor:
        arSubledgerTotal -
        (input.clientId
          ? arGl.signedMinor
          : (await sumPostedOnAccount(CONTROL_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, filter)).signedMinor),
      limitation:
        "Client invoices and receipts are not systematically posted to GL; differences are expected until AR journaling is implemented.",
      details: clientDetails.filter((d) => d.subledgerMinor !== d.glMinor),
    },
    {
      controlAccountCode: CONTROL_ACCOUNT_CODES.VENDOR_ADVANCES,
      controlAccountName: advanceAccount?.name ?? "Vendor Advances",
      subledgerLabel: "Advance subledger (committed AdvanceRequest — not fully implemented)",
      subledgerTotalMinor: 0,
      glControlBalanceMinor: advanceGlMinor,
      differenceMinor: -advanceGlMinor,
      limitation:
        "Operational advance outstanding is tracked on AdvanceRequest; a consolidated advance subledger total is not yet wired for reconciliation.",
      details: [],
    },
    {
      controlAccountCode: CONTROL_ACCOUNT_CODES.BANK_CASH,
      controlAccountName: bankAccount?.name ?? "Bank / Cash",
      subledgerLabel: "Posted GL bank balance vs imported statement coverage",
      subledgerTotalMinor: bankSubledgerMinor,
      glControlBalanceMinor: bankGl.signedMinor,
      differenceMinor: 0,
      limitation:
        unmatchedBankMinor._sum.amountMinor
          ? `${unmatchedBankMinor._sum.amountMinor} minor units on unmatched imported statement lines — not a subledger total; investigate via bank reconciliation.`
          : "Bank subledger is GL control balance; statement lines are evidence for reconciliation, not a second subledger.",
      details: [],
    },
    {
      controlAccountCode: CONTROL_ACCOUNT_CODES.GATEWAY_CLEARING,
      controlAccountName: clearingAccount?.name ?? "Gateway Clearing",
      subledgerLabel: "Gateway clearing GL vs payment reconciliation exceptions",
      subledgerTotalMinor: clearingGl.signedMinor,
      glControlBalanceMinor: clearingGl.signedMinor,
      differenceMinor: 0,
      limitation:
        gatewayOpen > 0
          ? `${gatewayOpen} open gateway reconciliation exception(s) — settlement may not match clearing balance timing.`
          : "No open gateway reconciliation exceptions.",
      details: [],
    },
  ];

  return {
    asOfDate: input.asOfDate.toISOString().slice(0, 10),
    currency,
    generatedAt: new Date().toISOString(),
    rows,
  };
}
