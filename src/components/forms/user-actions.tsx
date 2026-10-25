"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
export default function UserActions({
  id,
  email,
  onEdit,
}: {
  id: string;
  email: string | null;
  onEdit?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function resetPassword() {
    const pwd = window.prompt(`New password for ${email} (min 6 chars):`);
    if (!pwd) return;
    if (pwd.length < 6) {
      window.alert("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      const err = reportApiFailure(res, data, { toast, fallback: "Failed to update password" });
      window.alert(err.message);
      return;
    }
    window.alert("Password updated");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete user ${email}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    setBusy(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      const err = reportApiFailure(res, data, { toast, fallback: "Failed to delete user" });
      window.alert(err.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      {onEdit && (
        <button onClick={onEdit} disabled={busy} className="text-sm text-blue-600 hover:underline disabled:opacity-50">
          Edit
        </button>
      )}
      <button onClick={resetPassword} disabled={busy} className="text-sm text-blue-600 hover:underline disabled:opacity-50">
        Reset Password
      </button>
      <button onClick={remove} disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-50">
        Delete
      </button>
    </div>
  );
}
