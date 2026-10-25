"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isInternalRole } from "@/lib/teams";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type TeamOption = { id: string; code: string; name: string };
type Option = { id: string; name: string };
type DriverOption = { id: string; name: string; phone: string };

export type EditableUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  teamId?: string | null;
  teamCode?: string | null;
  employeeCode?: string | null;
  jobTitle?: string | null;
  isActive?: boolean;
  clientId?: string | null;
  vendorId?: string | null;
  driverId?: string | null;
};

const INTERNAL_ROLES = ["SUPER_ADMIN", "ADMIN", "SALES", "OPERATIONS", "FINANCE", "VENDOR_TEAM"];

const ROLE_TEAM_HINT: Record<string, string> = {
  SUPER_ADMIN: "ADMIN",
  ADMIN: "ADMIN",
  SALES: "SALES",
  OPERATIONS: "OPERATIONS",
  FINANCE: "FINANCE",
  VENDOR_TEAM: "VENDOR_TEAM",
};

export default function UserEditDialog({
  user,
  teams,
  clients,
  vendors,
  drivers,
  actorRole,
  open,
  onClose,
}: {
  user: EditableUser;
  teams: TeamOption[];
  clients: Option[];
  vendors: Option[];
  drivers: DriverOption[];
  actorRole: string;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    name: user.name ?? "",
    role: user.role,
    teamId: user.teamId ?? "",
    employeeCode: user.employeeCode ?? "",
    jobTitle: user.jobTitle ?? "",
    clientId: user.clientId ?? "",
    vendorId: user.vendorId ?? "",
    driverId: user.driverId ?? "",
    isActive: user.isActive ?? true,
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setForm({
      name: user.name ?? "",
      role: user.role,
      teamId: user.teamId ?? teams.find((t) => t.code === user.teamCode)?.id ?? "",
      employeeCode: user.employeeCode ?? "",
      jobTitle: user.jobTitle ?? "",
      clientId: user.clientId ?? "",
      vendorId: user.vendorId ?? "",
      driverId: user.driverId ?? "",
      isActive: user.isActive ?? true,
      password: "",
    });
    setError("");
  }, [open, user, teams]);

  useEffect(() => {
    if (!open || !isInternalRole(form.role)) return;
    const hint = ROLE_TEAM_HINT[form.role];
    const match = teams.find((t) => t.code === hint);
    if (match && form.teamId !== match.id) setForm((f) => ({ ...f, teamId: match.id }));
  }, [form.role, teams, open]);

  if (!open) return null;

  const internal = isInternalRole(form.role);
  const canAssignSuperAdmin = actorRole === "SUPER_ADMIN";
  const roleOptions = [
    ...(canAssignSuperAdmin ? ["SUPER_ADMIN"] : []),
    "ADMIN",
    "SALES",
    "OPERATIONS",
    "FINANCE",
    "VENDOR_TEAM",
    "CLIENT",
    "VENDOR",
    "DRIVER",
  ].filter((r) => canAssignSuperAdmin || r !== "SUPER_ADMIN");

  async function save() {
    setError("");
    setBusy(true);
    const body: Record<string, unknown> = {
      name: form.name,
      role: form.role,
      isActive: form.isActive,
      teamId: internal ? form.teamId : null,
      employeeCode: internal ? form.employeeCode : null,
      jobTitle: internal ? form.jobTitle : null,
      clientId: form.role === "CLIENT" ? form.clientId : null,
      vendorId: form.role === "VENDOR" ? form.vendorId : null,
      driverId: form.role === "DRIVER" ? form.driverId : null,
    };
    if (form.password) body.password = form.password;

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to update user" });
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-xl border bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.role} onChange={(e) => set("role", e.target.value)}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          {internal && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.teamId} onChange={(e) => set("teamId", e.target.value)} required>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee ID</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="e.g. Finance Manager" />
              </div>
            </>
          )}
          {form.role === "CLIENT" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Linked Client</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
                <option value="">— Select —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {form.role === "VENDOR" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Linked Vendor</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)}>
                <option value="">— Select —</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
          {form.role === "DRIVER" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Linked Driver</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white" value={form.driverId} onChange={(e) => set("driverId", e.target.value)}>
                <option value="">— Select —</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.phone}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New password (optional)</label>
            <input type="password" className="w-full border rounded-md px-3 py-2 text-sm" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Leave blank to keep current" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Account active (can sign in)
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
