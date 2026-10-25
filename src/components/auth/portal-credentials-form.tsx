"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import ForgotPasswordPanel from "@/components/forms/forgot-password-panel";
import { useToast } from "@/components/toast";
import { LOGIN_PORTAL_MISMATCH_MESSAGE } from "@/lib/login-portal";
import type { LoginPortal } from "@/lib/login-portal";
import { cn } from "@/lib/utils";
import { resolvePostLoginPath } from "@/lib/vendor-quote-portal-url";
import { useSearchParams } from "next/navigation";

type PortalCredentialsFormProps = {
  loginPortal: LoginPortal;
  emailPlaceholder?: string;
  emailLabel?: string;
  supportFooter?: React.ReactNode;
  noticeFooter?: React.ReactNode;
};

const inputWrap =
  "flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 min-h-[52px] focus-within:ring-2 focus-within:ring-[#F5D33C]/40 focus-within:border-[#F5D33C]/60 transition-shadow";

function loginErrorMessage(error: string | undefined) {
  if (!error || error === "CredentialsSignin") return "Invalid email or password";
  if (error.includes(LOGIN_PORTAL_MISMATCH_MESSAGE) || error.includes("authorized")) {
    return LOGIN_PORTAL_MISMATCH_MESSAGE;
  }
  return error;
}

export default function PortalCredentialsForm({
  loginPortal,
  emailPlaceholder = "you@company.com or 9876543210",
  emailLabel = "Email or Phone",
  supportFooter,
  noticeFooter,
}: PortalCredentialsFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      loginPortal,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      const msg = loginErrorMessage(res.error);
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }
    const destRes = await fetch("/api/auth/post-login-destination");
    const dest = await destRes.json().catch(() => ({}));
    const fallback = typeof dest.path === "string" ? dest.path : "/";
    const path = resolvePostLoginPath(
      searchParams.get("next"),
      searchParams.get("callbackUrl"),
      fallback
    );
    toast.push({ title: "Signed in successfully", variant: "success" });
    router.push(path);
    router.refresh();
  }

  function handleSsoClick() {
    toast.push({
      title: "SSO is not configured for this environment. Use email and password to sign in.",
      variant: "info",
    });
  }

  if (mode === "forgot") {
    return (
      <ForgotPasswordPanel
        initialEmail={email.includes("@") ? email : ""}
        onBack={() => {
          setMode("signin");
          setError("");
        }}
        onSuccess={(resetEmail) => {
          setMode("signin");
          setError("");
          setPassword("");
          if (resetEmail) setEmail(resetEmail);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">{emailLabel}</label>
          <div className={inputWrap}>
            <Mail className="h-5 w-5 text-slate-400 shrink-0" />
            <input
              type="text"
              autoComplete="username"
              className="flex-1 min-w-0 border-0 bg-transparent py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={emailPlaceholder}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">Password</label>
          <div className={inputWrap}>
            <Lock className="h-5 w-5 text-slate-400 shrink-0" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="flex-1 min-w-0 border-0 bg-transparent py-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-slate-400 hover:text-slate-600 p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
              }}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl min-h-[52px] text-base font-bold",
            "bg-[#F5D33C] text-slate-900 hover:bg-[#EAC72E] disabled:opacity-60 transition-colors"
          )}
        >
          {loading ? "Signing in..." : "Sign in"}
          {!loading && <ArrowRight className="h-5 w-5" />}
        </button>
      </form>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-slate-200" />
        <span className="mx-4 text-xs font-medium text-slate-400 uppercase tracking-wide">or</span>
        <div className="flex-grow border-t border-slate-200" />
      </div>

      <button
        type="button"
        onClick={handleSsoClick}
        className="w-full flex items-center justify-center gap-2 rounded-xl min-h-[52px] border border-slate-300 bg-white text-slate-800 font-semibold hover:bg-slate-50 transition-colors"
      >
        <Lock className="h-4 w-4 text-slate-500" />
        Continue with SSO
      </button>

      {supportFooter}
      {noticeFooter}
    </div>
  );
}
