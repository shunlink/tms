import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "danger" | "info" | "muted" | "default";

const STATUS_MAP: Record<string, StatusTone> = {
  // Trip statuses
  PENDING: "muted",
  DISPATCHED: "info",
  IN_TRANSIT: "info",
  DELIVERED: "success",
  POD_RECEIVED: "warning",
  POD_PENDING: "warning",
  INVOICED: "info",
  CLOSED: "muted",
  CANCELLED: "danger",
  COMPLETED: "success",
  // Indent statuses
  DRAFT: "muted",
  OPEN: "info",
  QUOTED: "info",
  VENDOR_ALLOCATED: "warning",
  PLACEMENT_PENDING: "warning",
  VEHICLE_PLACED: "info",
  DRIVER_ASSIGNED: "info",
  // Generic
  ACTIVE: "success",
  INACTIVE: "muted",
  APPROVED: "success",
  REJECTED: "danger",
  REVIEW: "warning",
  SUBMITTED: "warning",
  PAID: "success",
  FAILED: "danger",
  RELEASED: "info",
  PENDING_REVIEW: "warning",
  NEGOTIATED: "info",
  VENDOR_ACCEPTED: "info",
  PROCESSING: "warning",
  PROCESSED: "success",
  SLA_BREACHED: "danger",
  PENDING_BALANCE_PAYMENT: "warning",
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  OVERDUE: "danger",
  ACTION_REQUIRED: "warning",
  SENT: "info",
  EXTERNAL: "muted",
  PENDING_VERIFICATION: "warning",
  VERIFIED: "success",
  BAD_POD: "danger",
  true: "success",
  false: "muted",
};

const LABELS: Record<string, string> = {
  POD_RECEIVED: "POD Received",
  CLOSED: "Trip Closed",
  INVOICED: "Invoiced",
  POD_PENDING: "POD Pending",
  IN_TRANSIT: "In Transit",
  VENDOR_ALLOCATED: "Vendor Allocated",
  PLACEMENT_PENDING: "Placement Pending",
  VEHICLE_PLACED: "Vehicle Placed",
  DRIVER_ASSIGNED: "Driver Assigned",
  true: "Active",
  false: "Inactive",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
  FAILED: "Failed",
  PENDING_REVIEW: "Pending Review",
  NEGOTIATED: "Negotiated",
  VENDOR_ACCEPTED: "Vendor Accepted",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  SLA_BREACHED: "SLA Breached",
  PENDING_BALANCE_PAYMENT: "Balance Due",
  ACTION_REQUIRED: "Action Required",
  EXTERNAL: "External Provider",
  PENDING_VERIFICATION: "Pending Verification",
  VERIFIED: "Verified",
  BAD_POD: "Bad POD",
};

function formatLabel(status: string): string {
  if (LABELS[status]) return LABELS[status];
  return status.replace(/_/g, " ");
}

export default function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = STATUS_MAP[status] ?? "default";
  return (
    <Badge variant={tone} className={cn("text-xs", className)}>
      {formatLabel(status)}
    </Badge>
  );
}
