"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AUDIT_ACTION_GROUPS, formatAuditAction } from "@/lib/audit-actions";

type EmployeeOption = { id: string; name: string | null; email: string | null; employeeCode: string | null };
type TeamOption = { id: string; code: string; name: string };

export default function AuditFilters({
  employees,
  teams,
  actions,
}: {
  employees: EmployeeOption[];
  teams: TeamOption[];
  actions: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      startTransition(() => {
        router.push(`/audit?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setParams({
      userId: String(fd.get("userId") ?? ""),
      teamCode: String(fd.get("teamCode") ?? ""),
      action: String(fd.get("action") ?? ""),
      entity: String(fd.get("entity") ?? ""),
      entityId: String(fd.get("entityId") ?? ""),
      tripId: String(fd.get("tripId") ?? ""),
      from: String(fd.get("from") ?? ""),
      to: String(fd.get("to") ?? ""),
    });
  };

  const clearFilters = () => {
    startTransition(() => router.push("/audit"));
  };

  const canonicalActions = AUDIT_ACTION_GROUPS.flatMap((g) => g.actions);
  const legacyActions = actions.filter((a) => !canonicalActions.includes(a));

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="userId">Employee</Label>
        <Select id="userId" name="userId" defaultValue={searchParams.get("userId") ?? ""}>
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name ?? e.email ?? e.id}
              {e.employeeCode ? ` (${e.employeeCode})` : ""}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="teamCode">Team</Label>
        <Select id="teamCode" name="teamCode" defaultValue={searchParams.get("teamCode") ?? ""}>
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.code}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="action">Action</Label>
        <Select id="action" name="action" defaultValue={searchParams.get("action") ?? ""}>
          <option value="">All actions</option>
          {AUDIT_ACTION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.actions.map((a) => (
                <option key={a} value={a}>
                  {formatAuditAction(a)}
                </option>
              ))}
            </optgroup>
          ))}
          {legacyActions.length > 0 && (
            <optgroup label="Legacy">
              {legacyActions.map((a) => (
                <option key={a} value={a}>
                  {formatAuditAction(a)}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entity">Entity type</Label>
        <Input
          id="entity"
          name="entity"
          placeholder="e.g. Trip, ClientInvoice"
          defaultValue={searchParams.get("entity") ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entityId">Entity ID</Label>
        <Input
          id="entityId"
          name="entityId"
          placeholder="Entity record ID"
          defaultValue={searchParams.get("entityId") ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tripId">Trip</Label>
        <Input
          id="tripId"
          name="tripId"
          placeholder="Trip ID"
          defaultValue={searchParams.get("tripId") ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          name="from"
          type="datetime-local"
          defaultValue={searchParams.get("from") ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          name="to"
          type="datetime-local"
          defaultValue={searchParams.get("to") ?? ""}
        />
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Filtering…" : "Apply filters"}
        </Button>
        <Button type="button" variant="outline" onClick={clearFilters} disabled={pending}>
          Clear
        </Button>
      </div>
    </form>
  );
}
