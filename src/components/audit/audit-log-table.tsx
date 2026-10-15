"use client";

import DataTable, { type DataColumn } from "@/components/data-table";
import { formatAuditAction } from "@/lib/audit-actions";

export type AuditLogRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  actorName: string | null;
  employeeCode: string | null;
  teamCode: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  tripId: string | null;
  meta: string | null;
  before: string | null;
  after: string | null;
  createdAt: string | Date;
};

function summarizeChange(row: AuditLogRow): string {
  if (row.before || row.after) {
    const parts: string[] = [];
    if (row.before) parts.push(`before: ${row.before}`);
    if (row.after) parts.push(`after: ${row.after}`);
    return parts.join(" · ");
  }
  return row.meta ?? "—";
}

const columns: DataColumn[] = [
  { key: "createdAt", header: "When", kind: "date" },
  { key: "actorLabel", header: "Employee" },
  { key: "teamCode", header: "Team" },
  { key: "actionLabel", header: "Action" },
  { key: "entity", header: "Entity" },
  { key: "entityId", header: "Entity ID" },
  { key: "tripId", header: "Trip" },
  { key: "details", header: "Details" },
];

export default function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  const tableRows = rows.map((r) => ({
    ...r,
    actorLabel: r.actorName
      ? `${r.actorName}${r.employeeCode ? ` (${r.employeeCode})` : ""}`
      : r.userEmail ?? "system",
    actionLabel: formatAuditAction(r.action),
    details: summarizeChange(r),
    createdAt: typeof r.createdAt === "string" ? r.createdAt : r.createdAt.toISOString(),
  }));

  return (
    <DataTable
      rows={tableRows}
      columns={columns}
      searchKeys={["actorLabel", "actionLabel", "entity", "entityId", "tripId", "details", "teamCode"]}
      pageSize={25}
      exportName="audit-log"
      emptyText="No activity matches the current filters."
    />
  );
}
