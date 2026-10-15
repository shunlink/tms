"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/brand-logo";
import PortalAuthPageFooter from "@/components/auth/portal-auth-page-footer";
import { Button } from "@/components/ui/button";
import { authInputClass, authLabelClass } from "@/components/auth-shell";
import { useToast } from "@/components/toast";
import { homePathForRole } from "@/lib/auth-home";
import { driverLoginOtpRequestSchema, otpSchema } from "@/lib/validation";
import { otpErrorMessage, parseApiError } from "@/lib/toast-utils";

export default function DriverLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [dlNumber, setDlNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = driverLoginOtpRequestSchema.safeParse({ dlNumber, phone });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please check your details.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }

    setLoading(true);
    const res = await fetch("/api/drivers/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      const msg = otpErrorMessage(data) || parseApiError(data, "Failed to send OTP");
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      if (typeof data.retryAfter === "number" && data.retryAfter > 0) {
        setResendCooldown(data.retryAfter);
      }
      return;
    }

    setOtpSent(true);
    setResendCooldown(60);
    toast.push({ title: "OTP sent successfully", variant: "success" });
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsed = otpSchema.safeParse(otp);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please enter a valid OTP.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", {
      email: dlNumber,
      password: parsed.data,
      driverLogin: "1",
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      const msg = "Incorrect OTP. Please try again.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }
    toast.push({ title: "Signed in successfully", variant: "success" });
    router.push(homePathForRole("DRIVER"));
    router.refresh();
  }

  async function handleResend() {
    if (resendCooldown > 0) {
      toast.push({
        title: `Please wait ${resendCooldown}s before requesting another OTP.`,
        variant: "warning",
      });
      return;
    }
    setOtp("");
    setOtpSent(false);
    await sendOtp({ preventDefault: () => {} } as React.FormEvent);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] px-6 py-8 sm:px-10">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to portal selection
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-8 sm:p-10">
          <BrandLogo variant="light" href="/login" size="md" className="mb-8" />
          <h1 className="font-heading text-2xl font-bold text-slate-900 mb-2">Driver login</h1>
          <p className="text-sm text-slate-500 mb-8">Sign in with your DL number and registered phone OTP.</p>

          <div className="space-y-5">
            <div>
              <label className={authLabelClass}>DL Number</label>
              <input
                type="text"
                className={authInputClass}
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value)}
                placeholder="MH0123456789"
                required
              />
            </div>
            {!otpSent ? (
              <form onSubmit={sendOtp} className="space-y-5">
                <div>
                  <label className={authLabelClass}>Registered Phone</label>
                  <input
                    type="tel"
                    className={authInputClass}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9999999999"
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full h-12 text-base rounded-lg" disabled={loading}>
                  {loading ? "Sending..." : "Send OTP"}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-5">
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
                {error && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full h-12 text-base rounded-lg" disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Login"}
                </Button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="w-full text-sm text-slate-500 hover:underline disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full">
        <PortalAuthPageFooter />
      </div>
    </div>
  );
}
