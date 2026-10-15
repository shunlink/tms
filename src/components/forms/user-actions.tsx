"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    window.alert(res.ok ? "Password updated" : "Failed to update password");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete user ${email}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || "Failed to delete user");
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
