"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authInputClass, authLabelClass } from "@/components/auth-shell";
import { settingsSectionClass } from "@/components/settings/settings-styles";
import { PORTAL_ACCESS_EMAIL_MARKER } from "@/lib/superadmin/portal-access-marker";
import { parsePortalAccessIdentifier } from "@/lib/superadmin/portal-access-marker";
import type { PortalAccessTargetPreview } from "@/lib/superadmin/portal-access-session.service";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
export default function PortalAccessForm() {
  const toast = useToast();
  const router = useRouter();
  const { update } = useSession();
  const [identifier, setIdentifier] = useState(`${PORTAL_ACCESS_EMAIL_MARKER}`);
  const [masterOtp, setMasterOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PortalAccessTargetPreview | null>(null);

  async function verifyPreview() {
    setError("");
    const parsed = parsePortalAccessIdentifier(identifier);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!masterOtp.trim()) {
      setError("Enter the current Master OTP");
      return;
    }

    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/superadmin/portal-access/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, masterOtp }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Verification failed" });
        return;
      }
      setPreview((data as { target: PortalAccessTargetPreview }).target);
    } finally {
      setLoading(false);
    }
  }

  async function confirmAccess() {
    if (!preview) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/portal-access/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, masterOtp }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Could not start portal access" });
        setPreview(null);
        return;
      }
      const body = data as { portalAccess: unknown; portalHome: string };
      await update({ portalAccess: body.portalAccess });
      router.push(body.portalHome);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={settingsSectionClass}>
      <CardHeader>
        <CardTitle>Employee portal access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Enter the employee email prefixed with <code className="font-mono">{PORTAL_ACCESS_EMAIL_MARKER}</code>{" "}
          (for example <code className="font-mono">{PORTAL_ACCESS_EMAIL_MARKER}employee@shunlink.in</code>) and the
          current Master OTP. This does not sign you in as the employee with their password.
        </p>

        <div>
          <label className={authLabelClass}>Employee identifier</label>
          <input
            className={authInputClass}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setPreview(null);
            }}
            placeholder={`${PORTAL_ACCESS_EMAIL_MARKER}employee@shunlink.in`}
            autoComplete="off"
          />
        </div>

        <div>
          <label className={authLabelClass}>Master OTP</label>
          <input
            type="password"
            className={authInputClass}
            value={masterOtp}
            onChange={(e) => {
              setMasterOtp(e.target.value);
              setPreview(null);
            }}
            autoComplete="off"
          />
        </div>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        {!preview ? (
          <Button
            type="button"
            disabled={loading}
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => verifyPreview()}
          >
            {loading ? "Verifying…" : "Verify employee"}
          </Button>
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-800">Confirm access</p>
            <ul className="text-sm text-slate-700 space-y-1">
              <li><span className="text-slate-500">Name:</span> {preview.name ?? "—"}</li>
              <li><span className="text-slate-500">Email:</span> {preview.email}</li>
              <li><span className="text-slate-500">Role:</span> {preview.role}</li>
              {preview.teamName && (
                <li><span className="text-slate-500">Team:</span> {preview.teamName}</li>
              )}
              <li><span className="text-slate-500">Portal:</span> {preview.portalLabel}</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={loading}
                className="bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => confirmAccess()}
              >
                {loading ? "Starting…" : "Enter portal"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setPreview(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
