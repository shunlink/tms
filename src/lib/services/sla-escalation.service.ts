import { getRedis } from "../redis";
import { SLA_TYPES, type SlaType } from "../sla-types";

const LOCK_KEY = "sla:escalation:lock";
const LOCK_TTL_SEC = 55;

export type SlaEscalationResult = {
  skipped: boolean;
  advance: number;
  badPod: number;
  invoice: number;
  balancePayment: number;
  total: number;
};

const EMPTY_RESULT: SlaEscalationResult = {
  skipped: false,
  advance: 0,
  badPod: 0,
  invoice: 0,
  balancePayment: 0,
  total: 0,
};

async function acquireLock(): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return true;
  const token = `${Date.now()}`;
  const result = await redis.set(LOCK_KEY, token, "EX", LOCK_TTL_SEC);
  return result === "OK";
}

async function releaseLock() {
  const redis = await getRedis();
  if (!redis) return;
  await redis.del(LOCK_KEY);
}

const TYPE_RUNNERS: Record<SlaType, () => Promise<number>> = {
  [SLA_TYPES.ADVANCE_REQUEST]: async () => {
    const { escalateOverdueAdvanceRequests } = await import("./trip-advance.service");
    return escalateOverdueAdvanceRequests();
  },
  [SLA_TYPES.BAD_POD]: async () => {
    const { escalateOverdueBadPods } = await import("./pod.service");
    return escalateOverdueBadPods();
  },
  [SLA_TYPES.INVOICE]: async () => {
    const { escalateOverdueInvoiceTasks } = await import("./invoice-task.service");
    return escalateOverdueInvoiceTasks();
  },
  [SLA_TYPES.BALANCE_PAYMENT]: async () => {
    const { escalateOverdueBalancePayments } = await import("./vendor-balance-payment.service");
    return escalateOverdueBalancePayments();
  },
};

/**
 * Single SLA escalation entry point.
 * Uses Redis lock when available to avoid duplicate concurrent breaches.
 */
export async function runSlaEscalations(types?: SlaType[]): Promise<SlaEscalationResult> {
  const locked = await acquireLock();
  if (!locked) {
    return { ...EMPTY_RESULT, skipped: true };
  }

  try {
    const toRun =
      types && types.length > 0 ? types : (Object.values(SLA_TYPES) as SlaType[]);

    let advance = 0;
    let badPod = 0;
    let invoice = 0;
    let balancePayment = 0;

    for (const type of toRun) {
      const count = await TYPE_RUNNERS[type]();
      switch (type) {
        case SLA_TYPES.ADVANCE_REQUEST:
          advance = count;
          break;
        case SLA_TYPES.BAD_POD:
          badPod = count;
          break;
        case SLA_TYPES.INVOICE:
          invoice = count;
          break;
        case SLA_TYPES.BALANCE_PAYMENT:
          balancePayment = count;
          break;
      }
    }

    // Alerts must never outlive the business state that raised them.
    const { reconcileImportantEvents } = await import("./important-event.service");
    await reconcileImportantEvents();

    return {
      skipped: false,
      advance,
      badPod,
      invoice,
      balancePayment,
      total: advance + badPod + invoice + balancePayment,
    };
  } finally {
    await releaseLock();
  }
}

/** Run all four SLA workflows — call from dashboards and scheduled jobs. */
export async function runAllSlaEscalations() {
  return runSlaEscalations();
}
