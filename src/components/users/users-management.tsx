"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UserForm from "@/components/forms/user-form";
import UserActions from "@/components/forms/user-actions";
import UserEditDialog, { type EditableUser } from "@/components/forms/user-edit-dialog";
import { formatDate } from "@/lib/utils";
import { isInternalRole } from "@/lib/teams";

type UserRow = EditableUser & {
  teamName: string | null;
  linked: string | null;
  createdAt: string | Date;
};

type TeamRow = { id: string; code: string; name: string; memberCount: number };
type Option = { id: string; name: string };
type DriverOption = { id: string; name: string; phone: string };

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-rose-100 text-rose-700",
  ADMIN: "bg-purple-100 text-purple-700",
  SALES: "bg-cyan-100 text-cyan-700",
  OPERATIONS: "bg-blue-100 text-blue-700",
  FINANCE: "bg-indigo-100 text-indigo-700",
  VENDOR_TEAM: "bg-orange-100 text-orange-700",
  CLIENT: "bg-green-100 text-green-700",
  VENDOR: "bg-amber-100 text-amber-700",
  DRIVER: "bg-slate-100 text-slate-700",
};

export default function UsersManagement({
  users,
  teams,
  clients,
  vendors,
  drivers,
  suggestedEmployeeCode,
  actorRole,
}: {
  users: UserRow[];
  teams: TeamRow[];
  clients: Option[];
  vendors: Option[];
  drivers: DriverOption[];
  suggestedEmployeeCode: string;
  actorRole: string;
}) {
  const [tab, setTab] = useState<"employees" | "portal">("employees");
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const employees = useMemo(() => users.filter((u) => isInternalRole(u.role)), [users]);
  const portalUsers = useMemo(() => users.filter((u) => !isInternalRole(u.role)), [users]);
  const activeRows = tab === "employees" ? employees : portalUsers;

  const teamOptions = teams.map((t) => ({ id: t.id, code: t.code, name: t.name }));

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b">
        <button
          type="button"
          onClick={() => setTab("employees")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "employees"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Internal Employees ({employees.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("portal")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "portal"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Portal Accounts ({portalUsers.length})
        </button>
      </div>

      {tab === "employees" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {teams.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-slate-500">{t.name}</p>
                <p className="text-xl font-bold text-slate-900">{t.memberCount}</p>
                <p className="text-xs text-slate-400">member{t.memberCount === 1 ? "" : "s"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UserForm
        mode={tab === "employees" ? "employee" : "portal"}
        clients={clients}
        vendors={vendors}
        drivers={drivers}
        teams={teamOptions}
        suggestedEmployeeCode={tab === "employees" ? suggestedEmployeeCode : undefined}
        actorRole={actorRole}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {tab === "employees" ? `Employees (${employees.length})` : `Portal Users (${portalUsers.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                {tab === "employees" ? (
                  <>
                    <th className="pb-3 font-medium">Employee ID</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Job Title</th>
                    <th className="pb-3 font-medium">Team</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                  </>
                ) : (
                  <>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Linked To</th>
                    <th className="pb-3 font-medium">Status</th>
                  </>
                )}
                <th className="pb-3 font-medium">Created</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={tab === "employees" ? 9 : 7} className="py-8 text-center text-slate-500">
                    {tab === "employees" ? "No employees yet. Add one above." : "No portal accounts yet."}
                  </td>
                </tr>
              ) : (
                activeRows.map((u) => (
                  <tr key={u.id} className={`border-b last:border-0 hover:bg-slate-50 ${!u.isActive ? "opacity-60" : ""}`}>
                    {tab === "employees" ? (
                      <>
                        <td className="py-3 font-mono text-xs text-slate-700">{u.employeeCode ?? "—"}</td>
                        <td className="py-3 font-medium text-slate-900">{u.name ?? "—"}</td>
                        <td className="py-3 text-slate-600">{u.email}</td>
                        <td className="py-3 text-slate-600">{u.jobTitle ?? "—"}</td>
                        <td className="py-3 text-slate-600">{u.teamName ?? "—"}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${roleColors[u.role] ?? "bg-slate-100 text-slate-700"}`}>
                            {u.role.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 font-medium text-slate-900">{u.email}</td>
                        <td className="py-3 text-slate-600">{u.name ?? "—"}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${roleColors[u.role] ?? "bg-slate-100 text-slate-700"}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600">{u.linked ?? "—"}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="py-3 text-slate-600">{formatDate(u.createdAt)}</td>
                    <td className="py-3">
                      <UserActions
                        id={u.id}
                        email={u.email}
                        onEdit={() => setEditUser(u)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editUser && (
        <UserEditDialog
          user={editUser}
          teams={teamOptions}
          clients={clients}
          vendors={vendors}
          drivers={drivers}
          actorRole={actorRole}
          open={Boolean(editUser)}
          onClose={() => setEditUser(null)}
        />
      )}
    </div>
  );
}
