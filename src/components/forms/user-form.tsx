"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isInternalRole } from "@/lib/teams";

type Option = { id: string; name: string };
type DriverOption = { id: string; name: string; phone: string };
type TeamOption = { id: string; code: string; name: string };

const INTERNAL_ROLES = ["SUPER_ADMIN", "ADMIN", "SALES", "OPERATIONS", "FINANCE", "VENDOR_TEAM"];
const PORTAL_ROLES = ["CLIENT", "VENDOR", "DRIVER"];

const ROLE_TEAM_HINT: Record<string, string> = {
  SUPER_ADMIN: "ADMIN",
  ADMIN: "ADMIN",
  SALES: "SALES",
  OPERATIONS: "OPERATIONS",
  FINANCE: "FINANCE",
  VENDOR_TEAM: "VENDOR_TEAM",
};

function defaultRole(mode: "employee" | "portal", actorRole?: string) {
  if (mode === "portal") return "CLIENT";
  return actorRole === "SUPER_ADMIN" ? "OPERATIONS" : "OPERATIONS";
}

export default function UserForm({
  mode,
  clients,
  vendors,
  drivers,
  teams: initialTeams,
  suggestedEmployeeCode,
  actorRole,
}: {
  mode: "employee" | "portal";
  clients: Option[];
  vendors: Option[];
  drivers: DriverOption[];
  teams?: TeamOption[];
  suggestedEmployeeCode?: string;
  actorRole?: string;
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamOption[]>(initialTeams ?? []);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: defaultRole(mode, actorRole),
    teamId: "",
    employeeCode: suggestedEmployeeCode ?? "",
    jobTitle: "",
    clientId: "",
    vendorId: "",
    driverId: "",
  });
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const canAssignSuperAdmin = actorRole === "SUPER_ADMIN";
  const roleOptions =
    mode === "employee"
      ? INTERNAL_ROLES.filter((r) => canAssignSuperAdmin || r !== "SUPER_ADMIN")
      : PORTAL_ROLES;

  useEffect(() => {
    if (initialTeams?.length) return;
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTeams(data.map((t: TeamOption & { _count?: unknown }) => ({ id: t.id, code: t.code, name: t.name })));
      })
      .catch(() => {});
  }, [initialTeams]);

  useEffect(() => {
    setForm({
      email: "",
      name: "",
      password: "",
      role: defaultRole(mode, actorRole),
      teamId: "",
      employeeCode: mode === "employee" ? (suggestedEmployeeCode ?? "") : "",
      jobTitle: "",
      clientId: "",
      vendorId: "",
      driverId: "",
    });
    setError("");
    setOkMsg("");
  }, [mode, suggestedEmployeeCode, actorRole]);

  useEffect(() => {
    if (mode !== "employee" || !isInternalRole(form.role)) {
      setForm((f) => ({ ...f, teamId: "", employeeCode: "", jobTitle: "" }));
      return;
    }
    const hint = ROLE_TEAM_HINT[form.role];
    const match = teams.find((t) => t.code === hint);
    if (match) setForm((f) => ({ ...f, teamId: match.id }));
  }, [form.role, teams, mode]);

  const internal = mode === "employee" && isInternalRole(form.role);
  const teamsForRole = teams.filter((t) => {
    const hint = ROLE_TEAM_HINT[form.role];
    return form.role === "SUPER_ADMIN" ? t.code === "ADMIN" : t.code === hint;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOkMsg("");
    setBusy(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create user");
      return;
    }
    setOkMsg(`${mode === "employee" ? "Employee" : "Portal user"} ${form.email} created`);
    setForm({
      email: "",
      name: "",
      password: "",
      role: defaultRole(mode, actorRole),
      teamId: teams.find((t) => t.code === "OPERATIONS")?.id ?? "",
      employeeCode: mode === "employee" ? (suggestedEmployeeCode ?? "") : "",
      jobTitle: "",
      clientId: "",
      vendorId: "",
      driverId: "",
    });
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{mode === "employee" ? "Add Employee" : "Add Portal Account"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input type="email" className="w-full border rounded-md px-3 py-2 text-sm" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password * (min 6)</label>
            <input type="password" className="w-full border rounded-md px-3 py-2 text-sm" value={form.password} onChange={(e) => set("password", e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.role} onChange={(e) => set("role", e.target.value)}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          {internal && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Team *</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={form.teamId}
                  onChange={(e) => set("teamId", e.target.value)}
                  required
                >
                  <option value="">— Select team —</option>
                  {(teamsForRole.length ? teamsForRole : teams).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee ID</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} placeholder="e.g. EMP007" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="e.g. Finance Manager" />
              </div>
            </>
          )}

          {form.role === "CLIENT" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Linked Client *</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.clientId} onChange={(e) => set("clientId", e.target.value)} required>
                <option value="">— Select —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {form.role === "VENDOR" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Linked Vendor *</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)} required>
                <option value="">— Select —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          {form.role === "DRIVER" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Linked Driver *</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.driverId} onChange={(e) => set("driverId", e.target.value)} required>
                <option value="">— Select —</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.phone}</option>)}
              </select>
            </div>
          )}

          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          {okMsg && <p className="md:col-span-2 text-sm text-green-600">{okMsg}</p>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating..." : mode === "employee" ? "Create Employee" : "Create Portal Account"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
