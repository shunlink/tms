export const SLA_ESCALATION_QUEUE_NAME = "tms-sla-escalation";
export const SLA_ESCALATION_SCHEDULER_ID = "sla-escalation-tick";
export const SLA_ESCALATION_JOB_NAME = "run-all";

/** Default: every 15 minutes (onboarding 24h SLA does not need sub-minute precision). */
export function slaEscalationIntervalMs() {
  const raw = process.env.SLA_ESCALATION_EVERY_MS?.trim();
  const n = raw ? Number(raw) : 15 * 60 * 1000;
  return Number.isFinite(n) && n >= 60_000 ? n : 15 * 60 * 1000;
}
