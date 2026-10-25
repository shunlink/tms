"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authInputClass, authLabelClass } from "@/components/auth-shell";
import { settingsSectionClass } from "@/components/settings/settings-styles";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
export default function MasterOtpSettings() {
  const toast = useToast();
  const [status, setStatus] = useState<{ configured: boolean; lastGeneratedAt: string | null } | null>(
    null
  );
  const [password, setPassword] = useState("");
  const [revealedOtp, setRevealedOtp] = useState<string | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/superadmin/master-otp/status");
    if (res.ok) setStatus((await readJsonBody(res)) as { configured: boolean; lastGeneratedAt: string | null });
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function regenerate() {
    setError("");
    if (!password.trim()) {
      setError("Enter your Superadmin password to regenerate the Master OTP");
      return;
    }
    setLoading(true);
    setRevealedOtp(null);
    setConfirmReveal(false);
    try {
      const res = await fetch("/api/superadmin/master-otp/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await readJsonBody(res);
      if (!res.ok) {
        reportApiFailure(res, data, { toast, setError, fallback: "Regeneration failed" });
        return;
      }
      setRevealedOtp((data as { masterOtp: string }).masterOtp);
      setPassword("");
      await loadStatus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={settingsSectionClass}>
      <CardHeader>
        <CardTitle>Master OTP (portal access)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          High-entropy access code used with the <code className="font-mono">{`<=`}</code> employee identifier on the
          portal access page. Stored as a hash only; previous codes are invalidated immediately on regeneration.
        </p>

        {status && (
          <p className="text-sm text-slate-700">
            Status: {status.configured ? "Configured" : "Not configured yet"}
            {status.lastGeneratedAt && (
              <> · Last regenerated {new Date(status.lastGeneratedAt).toLocaleString()}</>
            )}
          </p>
        )}

        <div>
          <label className={authLabelClass}>Your password (re-authentication)</label>
          <input
            type="password"
            className={authInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="button"
          disabled={loading}
          className="bg-slate-900 text-white hover:bg-slate-800"
          onClick={() => regenerate()}
        >
          {loading ? "Generating…" : status?.configured ? "Regenerate Master OTP" : "Generate Master OTP"}
        </Button>

        {revealedOtp && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-2">
            {!confirmReveal ? (
              <Button type="button" variant="outline" onClick={() => setConfirmReveal(true)}>
                Reveal new Master OTP (one time)
              </Button>
            ) : (
              <>
                <p className="text-sm font-medium text-amber-950">Copy now — this will not be shown again.</p>
                <code className="block text-sm break-all font-mono bg-white p-2 rounded border">{revealedOtp}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => setRevealedOtp(null)}>
                  Hide
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
