/** Canonical employee audit action identifiers. */
export const AUDIT_ACTIONS = {
  // Finance
  APPROVED_ADVANCE: "APPROVED_ADVANCE",
  NEGOTIATED_ADVANCE: "NEGOTIATED_ADVANCE",
  CREATED_INVOICE: "CREATED_INVOICE",
  INVOICE_EDITED: "INVOICE_EDITED",
  INVOICE_FINALIZED: "INVOICE_FINALIZED",
  PROCESSED_BALANCE_PAYMENT: "PROCESSED_BALANCE_PAYMENT",
  BALANCE_PAYMENT_INITIATED: "BALANCE_PAYMENT_INITIATED",
  BALANCE_PAYMENT_APPROVED: "BALANCE_PAYMENT_APPROVED",
  TRIP_CHARGE_ADDED: "TRIP_CHARGE_ADDED",
  TRIP_CHARGE_REMOVED: "TRIP_CHARGE_REMOVED",
  FINANCIAL_NOTE_CREATED: "FINANCIAL_NOTE_CREATED",
  FINANCIAL_NOTE_UPDATED: "FINANCIAL_NOTE_UPDATED",
  FINANCIAL_NOTE_ISSUED: "FINANCIAL_NOTE_ISSUED",
  RECORDED_CLIENT_PAYMENT: "RECORDED_CLIENT_PAYMENT",
  CLIENT_PAYMENT_UPDATED: "CLIENT_PAYMENT_UPDATED",
  EXTERNAL_ADVANCE_UPDATED: "EXTERNAL_ADVANCE_UPDATED",
  ADVANCE_REJECTED: "ADVANCE_REJECTED",
  ADVANCE_PROCESSED: "ADVANCE_PROCESSED",
  ADVANCE_SLA_BREACHED: "ADVANCE_SLA_BREACHED",
  INVOICE_SLA_BREACHED: "INVOICE_SLA_BREACHED",
  BALANCE_PAYMENT_SLA_BREACHED: "BALANCE_PAYMENT_SLA_BREACHED",
  POD_SLA_BREACHED: "POD_SLA_BREACHED",

  // Operations
  POD_VERIFIED: "POD_VERIFIED",
  POD_VERIFICATION_FAILED: "POD_VERIFICATION_FAILED",
  RESOLVED_BAD_POD: "RESOLVED_BAD_POD",
  POD_UPLOADED: "POD_UPLOADED",

  // Sales
  CREATED_REQUIREMENT: "CREATED_REQUIREMENT",
  UPDATED_REQUIREMENT: "UPDATED_REQUIREMENT",

  // Admin
  EMPLOYEE_CREATED: "EMPLOYEE_CREATED",
  EMPLOYEE_UPDATED: "EMPLOYEE_UPDATED",
  EMPLOYEE_DEACTIVATED: "EMPLOYEE_DEACTIVATED",
  PERMISSION_CHANGED: "PERMISSION_CHANGED",
  ACCESS_ROLE_CHANGED: "ACCESS_ROLE_CHANGED",
  USER_ACCESS_CHANGED: "USER_ACCESS_CHANGED",
  ESCALATION_HANDLED: "ESCALATION_HANDLED",

  // Cross-cutting
  TRIP_UPDATED: "TRIP_UPDATED",
  TRIP_CREATED: "TRIP_CREATED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Human-readable labels for audit actions (includes legacy dot-notation entries). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  [AUDIT_ACTIONS.APPROVED_ADVANCE]: "Approved advance",
  [AUDIT_ACTIONS.NEGOTIATED_ADVANCE]: "Negotiated advance",
  [AUDIT_ACTIONS.CREATED_INVOICE]: "Created invoice",
  [AUDIT_ACTIONS.INVOICE_EDITED]: "Edited invoice",
  [AUDIT_ACTIONS.INVOICE_FINALIZED]: "Finalized invoice",
  [AUDIT_ACTIONS.PROCESSED_BALANCE_PAYMENT]: "Processed balance payment",
  [AUDIT_ACTIONS.BALANCE_PAYMENT_INITIATED]: "Balance payment initiated",
  [AUDIT_ACTIONS.BALANCE_PAYMENT_APPROVED]: "Approved vendor balance payable",
  [AUDIT_ACTIONS.TRIP_CHARGE_ADDED]: "Added trip charge",
  [AUDIT_ACTIONS.TRIP_CHARGE_REMOVED]: "Removed trip charge",
  [AUDIT_ACTIONS.RECORDED_CLIENT_PAYMENT]: "Recorded client payment",
  [AUDIT_ACTIONS.CLIENT_PAYMENT_UPDATED]: "Updated client payment",
  [AUDIT_ACTIONS.EXTERNAL_ADVANCE_UPDATED]: "Updated external advance record",
  "advance.external_selected": "External advance provider selected",
  [AUDIT_ACTIONS.ADVANCE_REJECTED]: "Rejected advance",
  [AUDIT_ACTIONS.ADVANCE_PROCESSED]: "Processed advance payment",
  [AUDIT_ACTIONS.ADVANCE_SLA_BREACHED]: "Advance SLA breached",
  [AUDIT_ACTIONS.INVOICE_SLA_BREACHED]: "Invoice SLA breached",
  [AUDIT_ACTIONS.BALANCE_PAYMENT_SLA_BREACHED]: "Balance payment SLA breached",
  [AUDIT_ACTIONS.POD_SLA_BREACHED]: "Bad POD SLA breached",
  [AUDIT_ACTIONS.POD_VERIFIED]: "POD verified",
  [AUDIT_ACTIONS.POD_VERIFICATION_FAILED]: "POD verification failed",
  [AUDIT_ACTIONS.RESOLVED_BAD_POD]: "Resolved bad POD",
  [AUDIT_ACTIONS.POD_UPLOADED]: "POD uploaded",
  [AUDIT_ACTIONS.CREATED_REQUIREMENT]: "Created requirement",
  [AUDIT_ACTIONS.UPDATED_REQUIREMENT]: "Updated requirement",
  [AUDIT_ACTIONS.EMPLOYEE_CREATED]: "Employee created",
  [AUDIT_ACTIONS.EMPLOYEE_UPDATED]: "Employee updated",
  [AUDIT_ACTIONS.EMPLOYEE_DEACTIVATED]: "Employee deactivated",
  [AUDIT_ACTIONS.PERMISSION_CHANGED]: "Permission changed",
  [AUDIT_ACTIONS.ESCALATION_HANDLED]: "Escalation handled",
  [AUDIT_ACTIONS.TRIP_UPDATED]: "Trip updated",
  [AUDIT_ACTIONS.TRIP_CREATED]: "Trip created",
  // Legacy actions still present in historical logs
  "advance.approved": "Approved advance",
  "advance.negotiated": "Negotiated advance",
  "advance.rejected": "Rejected advance",
  "advance.processed": "Processed advance",
  "advance.processing": "Advance processing started",
  "advance.requested": "Advance requested",
  "advance.requested_on_behalf": "Advance requested on behalf of vendor",
  "advance.decided": "Advance decided",
  "advance.paid": "Advance paid",
  "invoice.create": "Created invoice",
  "invoice.update": "Invoice updated",
  "payment.create": "Payment created",
  "payment.update": "Payment updated",
  "pod.approved": "POD verified",
  "pod.rejected": "POD verification failed",
  "pod.uploaded": "POD uploaded",
  "requirement.create": "Created requirement",
  "user.create": "Employee created",
  "user.update": "Employee updated",
  "user.deactivate": "Employee deactivated",
  "trip.create": "Trip created",
  "trip.status": "Trip status changed",
  "trip.pod_received": "Trip POD received",
  "indent.created": "Indent created",
  "indent.cancelled": "Indent cancelled",
  "indent.completed": "Indent completed",
};

export function formatAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

/** All filterable canonical actions grouped by team/function. */
export const AUDIT_ACTION_GROUPS: { label: string; actions: string[] }[] = [
  {
    label: "Finance",
    actions: [
      AUDIT_ACTIONS.APPROVED_ADVANCE,
      AUDIT_ACTIONS.NEGOTIATED_ADVANCE,
      AUDIT_ACTIONS.CREATED_INVOICE,
      AUDIT_ACTIONS.INVOICE_EDITED,
      AUDIT_ACTIONS.INVOICE_FINALIZED,
      AUDIT_ACTIONS.PROCESSED_BALANCE_PAYMENT,
      AUDIT_ACTIONS.BALANCE_PAYMENT_INITIATED,
      AUDIT_ACTIONS.RECORDED_CLIENT_PAYMENT,
      AUDIT_ACTIONS.CLIENT_PAYMENT_UPDATED,
      AUDIT_ACTIONS.EXTERNAL_ADVANCE_UPDATED,
      "advance.external_selected",
      AUDIT_ACTIONS.ADVANCE_REJECTED,
      AUDIT_ACTIONS.ADVANCE_PROCESSED,
      AUDIT_ACTIONS.ADVANCE_SLA_BREACHED,
      AUDIT_ACTIONS.INVOICE_SLA_BREACHED,
      AUDIT_ACTIONS.BALANCE_PAYMENT_SLA_BREACHED,
    ],
  },
  {
    label: "Operations",
    actions: [
      AUDIT_ACTIONS.POD_VERIFIED,
      AUDIT_ACTIONS.POD_VERIFICATION_FAILED,
      AUDIT_ACTIONS.RESOLVED_BAD_POD,
      AUDIT_ACTIONS.POD_UPLOADED,
      AUDIT_ACTIONS.POD_SLA_BREACHED,
    ],
  },
  {
    label: "Sales",
    actions: [AUDIT_ACTIONS.CREATED_REQUIREMENT, AUDIT_ACTIONS.UPDATED_REQUIREMENT],
  },
  {
    label: "Admin",
    actions: [
      AUDIT_ACTIONS.EMPLOYEE_CREATED,
      AUDIT_ACTIONS.EMPLOYEE_UPDATED,
      AUDIT_ACTIONS.EMPLOYEE_DEACTIVATED,
      AUDIT_ACTIONS.PERMISSION_CHANGED,
      AUDIT_ACTIONS.ESCALATION_HANDLED,
    ],
  },
];
