"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authInputClass, authLabelClass } from "@/components/auth-shell";
import { useToast } from "@/components/toast";
import {
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
} from "@/lib/validation";
import { readJsonBody, reportApiFailure } from "@/lib/api-client";

const FIELD_ERROR_CLASS =
  "text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3";

type Step = "request" | "reset";

/**
 * Two-step forgot-password flow shown inside the login card: request an email
 * OTP, then verify it and set a new password.
 */
export default function ForgotPasswordPanel({
  initialEmail = "",
  onBack,
  onSuccess,
}: {
  initialEmail?: string;
  onBack: () => void;
  onSuccess: (email: string) => void;
}) {
  const toast = useToast();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  async function sendOtp() {
    setError("");

    const parsed = forgotPasswordRequestSchema.safeParse({ email });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please check your email address.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await readJsonBody(res);
    setLoading(false);

    if (!res.ok) {
      const err = reportApiFailure(res, data, { toast, setError, fallback: "Failed to send reset code" });
      setResendCooldown(err.retryAfter && err.retryAfter > 0 ? err.retryAfter : 60);
      return;
    }

    setEmail(parsed.data.email);
    setOtp("");
    setStep("reset");
    setResendCooldown(60);
    setNotice(
      `If an account exists for ${parsed.data.email}, a 6-digit reset code is on its way. It expires in 10 minutes.`
    );
    toast.push({
      title: "Reset code sent",
      description: "Check your email inbox.",
      variant: "success",
    });
  }

  async function submitReset() {
    setError("");

    const parsed = forgotPasswordResetSchema.safeParse({ email, otp, newPassword });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please check the code and new password.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = "Passwords do not match.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await readJsonBody(res);
    setLoading(false);

    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to reset password" });
      return;
    }

    toast.push({
      title: "Password updated",
      description: "Sign in with your new password.",
      variant: "success",
    });
    onSuccess(parsed.data.email);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        {step === "request"
          ? "Enter the email registered with your account and we'll send a 6-digit verification code."
          : notice}
      </p>

      {step === "request" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp();
          }}
          className="space-y-5"
        >
          <div>
            <label className={authLabelClass}>Registered Email</label>
            <input
              type="email"
              className={authInputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>
          {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
          <Button type="submit" className="w-full h-12 text-base rounded-lg" disabled={loading}>
            {loading ? "Sending..." : "Send reset code"}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitReset();
          }}
          className="space-y-5"
        >
          <div>
            <label className={authLabelClass}>Email</label>
            <input
              type="email"
              className={authInputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className={authLabelClass}>Enter OTP</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={authInputClass}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              required
            />
          </div>
          <div>
            <label className={authLabelClass}>New Password</label>
            <input
              type="password"
              className={authInputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className={authLabelClass}>Confirm New Password</label>
            <input
              type="password"
              className={authInputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error && <p className={FIELD_ERROR_CLASS}>{error}</p>}
          <Button type="submit" className="w-full h-12 text-base rounded-lg" disabled={loading}>
            {loading ? "Updating..." : "Verify OTP & reset password"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setError("");
              }}
              className="text-slate-500 hover:underline"
            >
              Change email
            </button>
            <button
              type="button"
              onClick={() => void sendOtp()}
              disabled={resendCooldown > 0 || loading}
              className="text-slate-500 hover:underline disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      <button
        type="button"
        onClick={onBack}
        className="w-full text-sm text-slate-500 hover:underline text-center"
      >
        Back to sign in
      </button>
    </div>
  );
}
