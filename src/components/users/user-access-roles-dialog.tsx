"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import RoleTransferPanel, { type RoleTransferItem } from "@/components/users/role-transfer-panel";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type Props = {
  userId: string;
  userLabel: string;
  open: boolean;
  onClose: () => void;
};

export default function UserAccessRolesDialog({ userId, userLabel, open, onClose }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accessMode, setAccessMode] = useState<"INHERIT_ROLE" | "CUSTOM_ROLES">("INHERIT_ROLE");
  const [available, setAvailable] = useState<RoleTransferItem[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}/access-roles`);
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Failed to load access roles" });
        return;
      }
      const payload = (data as { data?: Record<string, unknown> }).data ?? (data as Record<string, unknown>);
      setAccessMode(payload.accessMode === "CUSTOM_ROLES" ? "CUSTOM_ROLES" : "INHERIT_ROLE");
      setAvailable((payload.available as RoleTransferItem[]) ?? []);
      setAssignedIds(((payload.assigned as { id: string }[]) ?? []).map((a) => a.id));
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}/access-roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessMode,
          accessRoleIds: accessMode === "CUSTOM_ROLES" ? assignedIds : [],
        }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Failed to save" });
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between z-10">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Access roles</h3>
            <p className="text-sm text-slate-500">{userLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="accessMode"
                    checked={accessMode === "INHERIT_ROLE"}
                    onChange={() => setAccessMode("INHERIT_ROLE")}
                  />
                  Inherit from job role (default)
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="accessMode"
                    checked={accessMode === "CUSTOM_ROLES"}
                    onChange={() => setAccessMode("CUSTOM_ROLES")}
                  />
                  Custom access roles
                </label>
              </div>

              {accessMode === "CUSTOM_ROLES" && (
                <p className="text-xs text-slate-500">
                  Select multiple roles with checkboxes, drag to the other panel, or use the action buttons.
                </p>
              )}

              {accessMode === "CUSTOM_ROLES" && (
                <RoleTransferPanel
                  allRoles={available}
                  assignedIds={assignedIds}
                  onAssignedIdsChange={setAssignedIds}
                />
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={save}
                  disabled={saving || (accessMode === "CUSTOM_ROLES" && assignedIds.length === 0)}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
