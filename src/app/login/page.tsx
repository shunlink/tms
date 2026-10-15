"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import AuthShell, { authInputClass, authLabelClass } from "@/components/auth-shell";
import { AUTH_BRANDING } from "@/lib/auth-branding";
import { useToast } from "@/components/toast";
import { driverLoginOtpRequestSchema, otpSchema } from "@/lib/validation";
import { otpErrorMessage, parseApiError } from "@/lib/toast-utils";
import ForgotPasswordPanel from "@/components/forms/forgot-password-panel";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const brand = AUTH_BRANDING.LOGIN;
  const [mode, setMode] = useState<"password" | "driver" | "forgot">("password");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  function goHome(role: string | undefined) {
    let home = "/";
    if (role === "CLIENT") home = "/portal/client";
    else if (role === "VENDOR") home = "/portal/vendor";
    else if (role === "DRIVER") home = "/driver";
    router.push(home);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      const msg = res.error === "CredentialsSignin" ? "Invalid email or password" : res.error;
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }
    const sessionRes = await fetch("/api/auth/session");
    const session = await sessionRes.json();
    toast.push({ title: "Signed in successfully", variant: "success" });
    goHome(session?.user?.role as string | undefined);
  }

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
    goHome("DRIVER");
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
    <AuthShell
      brand={brand}
      footer={
        <>
          New to ShunLink?{" "}
          <Link href="/signup" className="text-primary font-semibold hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className={`flex rounded-lg border border-border bg-muted p-1 mb-6 ${mode === "forgot" ? "hidden" : ""}`}>
        <button
          type="button"
          onClick={() => { setMode("password"); setError(""); }}
          className={`flex-1 rounded-md px-3 py-2.5 text-sm font-semibold min-h-[44px] ${mode === "password" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Email / Password
        </button>
        <button
          type="button"
          onClick={() => { setMode("driver"); setError(""); }}
          className={`flex-1 rounded-md px-3 py-2.5 text-sm font-semibold min-h-[44px] ${mode === "driver" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Driver Login
        </button>
      </div>

      {mode === "forgot" ? (
        <ForgotPasswordPanel
          initialEmail={email.includes("@") ? email : ""}
          onBack={() => { setMode("password"); setError(""); }}
          onSuccess={(resetEmail) => {
            setMode("password");
            setError("");
            setPassword("");
            if (resetEmail) setEmail(resetEmail);
          }}
        />
      ) : mode === "password" ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={authLabelClass}>Email or Phone</label>
            <input
              type="text"
              autoComplete="username"
              className={authInputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com or 9876543210"
              required
            />
          </div>
          <div>
            <label className={authLabelClass}>Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className={authInputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(""); }}
                className="text-sm text-primary font-semibold hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-12 text-base rounded-lg" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      ) : (
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
      )}

      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-sm text-muted-foreground text-center mb-3">Register as</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/signup/client" className="px-4 py-2 rounded-full bg-teal-50 text-teal-800 font-semibold hover:bg-teal-100 text-sm min-h-[44px] flex items-center">
            Client
          </Link>
          <Link href="/signup/vendor" className="px-4 py-2 rounded-full bg-amber-50 text-amber-900 font-semibold hover:bg-amber-100 text-sm min-h-[44px] flex items-center">
            Vendor
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">Demo admin: admin@tms.local / admin123</p>
      </div>
    </AuthShell>
  );
}
