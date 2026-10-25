"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PERMISSION_KEYS } from "@/lib/permissions";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
type AccessRoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: string[];
  userCount: number;
};

export default function AccessRolesManagement() {
  const toast = useToast();
  const router = useRouter();
  const [roles, setRoles] = useState<AccessRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeys, setEditKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/access-roles");
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to load access roles" });
      setLoading(false);
      return;
    }
    const payload = (data as { data?: { roles?: AccessRoleRow[] }; roles?: AccessRoleRow[] }).data ?? data;
    setRoles((payload as { roles?: AccessRoleRow[] }).roles ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const editingRole = useMemo(() => roles.find((r) => r.id === editingId) ?? null, [roles, editingId]);

  const permissionsByModule = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of PERMISSION_KEYS) {
      const module = key.split(".")[0] ?? "other";
      (map.get(module) ?? map.set(module, []).get(module)!).push(key);
    }
    return map;
  }, []);

  function startEdit(role: AccessRoleRow) {
    setEditingId(role.id);
    setEditKeys(new Set(role.permissions));
  }

  function toggleKey(key: string) {
    setEditKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function savePermissions() {
    if (!editingId) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/access-roles/${editingId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: Array.from(editKeys) }),
    });
    const data = await readJsonBody(res);
    setSaving(false);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to save permissions" });
      return;
    }
    setEditingId(null);
    await load();
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Access role bundles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Users</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.name}</td>
                  <td className="py-2 font-mono text-xs text-slate-600">{r.code}</td>
                  <td className="py-2">{r.userCount}</td>
                  <td className="py-2">
                    <button type="button" className="text-blue-600 hover:underline text-sm" onClick={() => startEdit(r)}>
                      Edit permissions ({r.permissions.length})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {editingRole && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRole.name}</CardTitle>
            <p className="text-sm text-slate-500 font-normal">Select module permissions for this bundle</p>
          </CardHeader>
          <CardContent className="max-h-[70vh] overflow-y-auto space-y-4">
            {Array.from(permissionsByModule.entries()).map(([module, keys]) => (
              <div key={module}>
                <p className="text-xs font-semibold uppercase text-slate-500 mb-2">{module}</p>
                <div className="space-y-1">
                  {keys.map((key: string) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={editKeys.has(key)} onChange={() => toggleKey(key)} />
                      <span className="font-mono text-xs">{key}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-white">
              <Button type="button" onClick={savePermissions} disabled={saving}>
                {saving ? "Saving…" : "Save bundle"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
