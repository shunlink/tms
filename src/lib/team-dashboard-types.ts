import type { TeamCode } from "./teams";
import type {
  FinanceDashboardFilters,
  FinanceDashboardMetrics,
} from "./services/finance-dashboard.service";

export type PendingTaskItem = {
  key: string;
  label: string;
  count: number;
  href: string;
};

export type DashboardMetric = {
  key: string;
  label: string;
  value: string | number;
  href?: string;
};

export type ActivityRow = {
  id: string;
  actorName: string | null;
  teamCode: string | null;
  action: string;
  entity: string;
  createdAt: Date;
};

export type ImportantEventRow = {
  id: string;
  type: string;
  severity: string;
  title: string;
  status: string;
  indentId: string | null;
  indentNumber: string | null;
  createdAt: Date;
};

export type SlaEscalationRow = {
  id: string;
  key: string;
  category: string;
  title: string;
  teamCode: string;
  teamLabel: string;
  breachedAt: Date;
  deadlineAt: Date | null;
  href: string;
  indentId: string | null;
  indentNumber: string | null;
};

export type TeamActivitySummary = {
  teamCode: string;
  teamName: string;
  count: number;
};

export type AdminDashboardExtras = {
  pendingTasks: PendingTaskItem[];
  slaBreaches: number;
  escalations: number;
  badPodEscalations: number;
  pendingInvoices: number;
  balancePaymentEscalations: number;
  advanceEscalations: number;
  teamActivity: TeamActivitySummary[];
  employeeActivity: ActivityRow[];
  slaEscalations: SlaEscalationRow[];
};

export type SalesDashboardData = {
  team: TeamCode;
  pendingTasks: PendingTaskItem[];
  metrics: DashboardMetric[];
  openRequirements: number;
  clientRaisedRequirements: number;
  indentsDraft: number;
  indentsActive: number;
  clientsActive: number;
  recentRequirements: {
    id: string;
    reqNumber: string;
    client: string;
    route: string;
    status: string;
  }[];
};

export type OperationsDashboardData = {
  team: TeamCode;
  pendingTasks: PendingTaskItem[];
  metrics: DashboardMetric[];
  activeTrips: number;
  myTrips: number;
  podsUploaded: number;
  podsPendingVerification: number;
  /** Rejected PODs still awaiting a corrected upload. */
  badPods: number;
  /** Open bad PODs whose 24h correction SLA has breached. */
  podEscalations: number;
  placementPending: number;
  tripsAwaitingPod: number;
  indentsReadyToClose: number;
  importantEvents: ImportantEventRow[];
  recentTrips: {
    id: string;
    lrNumber: string;
    route: string;
    client: string;
    status: string;
  }[];
};

export type FinanceDashboardData = {
  team: TeamCode;
  filters: FinanceDashboardFilters;
  metrics: FinanceDashboardMetrics;
  pendingTasks: PendingTaskItem[];
  advance: {
    pendingRequests: number;
    negotiations: number;
    vendorAccepted: number;
    processing: number;
    externalProvider: number;
    slaBreached: number;
  };
  invoice: {
    podVerified: number;
    invoicePending: number;
    draftInvoices: number;
    invoiceDeadlineSoon: number;
    slaBreached: number;
    recentlyCreated: number;
  };
  balancePayment: {
    pending: number;
    processing: number;
    processed: number;
    deadlineSoon: number;
    slaBreached: number;
  };
  clientPayments: {
    advances: number;
    paymentsReceived: number;
    missingProof: number;
  };
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    client: string;
    totalAmount: number;
    status: string;
    createdAt: Date;
  }[];
};
