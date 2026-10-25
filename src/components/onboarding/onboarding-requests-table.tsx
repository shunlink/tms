"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserPlus } from "lucide-react";
import StatusBadge from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { businessTypeLabel } from "@/lib/client-business-types";
import { ONBOARDING_CASE_STATUS } from "@/lib/onboarding-case-status";
import type { OnboardingRequestListRow } from "@/lib/services/onboarding.service";
import { formatDate } from "@/lib/utils";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Assignee = { id: string; name: string | null; email: string | null; role: string };

export default function OnboardingRequestsTable({
  requests,
  canAssign,
}: {
  requests: OnboardingRequestListRow[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [assignClientId, setAssignClientId] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignError, setAssignError] = useState("");

  async function openAssign(clientId: string) {
    setAssignClientId(clientId);
    setSelectedEmployeeId("");
    setAssignError("");
    setLoadingAssignees(true);
    try {
      const res = await fetch("/api/onboarding-requests/assignees");
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, fallback: "Failed to load employees" });
        setAssignClientId(null);
        return;
      }
      setAssignees((data as { assignees: Assignee[] }).assignees ?? []);
    } finally {
      setLoadingAssignees(false);
    }
  }

  async function confirmAssign() {
    if (!assignClientId || !selectedEmployeeId) return;
    setAssignBusy(true);
    setAssignError("");
    const res = await fetch(`/api/onboarding-requests/${assignClientId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: selectedEmployeeId }),
    });
    setAssignBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError: setAssignError, fallback: "Assignment failed" });
      return;
    }
    toast.push({ title: "Assigned to employee", variant: "success" });
    setAssignClientId(null);
    router.refresh();
  }

  const colSpan = canAssign ? 8 : 7;

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-500">
            <th className="pb-3 font-medium">Company</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium">Contact</th>
            <th className="pb-3 font-medium">Phone</th>
            <th className="pb-3 font-medium">Email</th>
            <th className="pb-3 font-medium">Business type</th>
            <th className="pb-3 font-medium">Waiting since</th>
            {canAssign && <th className="pb-3 font-medium text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="py-8 text-center text-slate-400">
                No onboarding requests in your queue.
              </td>
            </tr>
          )}
          {requests.map((r) => {
            const escalated =
              r.isSlaEscalated && r.status === ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE;
            const canOpen =
              r.status === ONBOARDING_CASE_STATUS.ASSIGNED_TO_EMPLOYEE ||
              (canAssign &&
                (r.status === ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION ||
                  r.status === ONBOARDING_CASE_STATUS.PENDING_OPS_ONBOARDING));
            return (
              <tr
                key={r.clientId}
                className={`border-b last:border-0 hover:bg-slate-50 ${
                  escalated ? "bg-amber-50/80" : ""
                }`}
              >
                <td className="py-3 font-medium">
                  {canOpen ? (
                    <Link
                      href={`/onboarding-requests/${r.clientId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                  {escalated && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Pending by employee
                    </span>
                  )}
                </td>
                <td className="py-3">
                  <StatusBadge status={r.status} />
                  {r.assignedEmployeeName && (
                    <p className="text-xs text-slate-500 mt-1">→ {r.assignedEmployeeName}</p>
                  )}
                </td>
                <td className="py-3">{r.contactName ?? "—"}</td>
                <td className="py-3">{r.phone ?? "—"}</td>
                <td className="py-3">{r.email ?? "—"}</td>
                <td className="py-3">{businessTypeLabel(r.businessType)}</td>
                <td className="py-3 text-slate-600">{formatDate(r.waitingSince)}</td>
                {canAssign && (
                  <td className="py-3 text-right">
                    {r.status === ONBOARDING_CASE_STATUS.PARTIAL_SUBMISSION && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg gap-1.5"
                        onClick={() => openAssign(r.clientId)}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Assign
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {assignClientId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Assign to employee</h3>
            <p className="text-sm text-slate-600">
              Choose a Sales or Operations team member to complete this client&apos;s onboarding.
            </p>
            {loadingAssignees ? (
              <p className="text-sm text-slate-500">Loading employees…</p>
            ) : (
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                <option value="">Select employee</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.name || a.email) ?? a.id} ({a.role})
                  </option>
                ))}
              </select>
            )}
            {assignError && <p className="text-sm text-red-600">{assignError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={assignBusy}
                onClick={() => setAssignClientId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={assignBusy || !selectedEmployeeId}
                onClick={() => void confirmAssign()}
              >
                {assignBusy ? "Assigning…" : "Assign"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
