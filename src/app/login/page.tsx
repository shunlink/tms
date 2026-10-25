"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Users,
  Truck,
  Building2,
  Package,
  BarChart3,
  FileText,
  FileCheck2,
  ShieldCheck,
  Network,
  TrendingUp,
  Phone,
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { useToast } from "@/components/toast";
import { driverLoginOtpRequestSchema, otpSchema, signupSchema } from "@/lib/validation";
import { otpErrorMessage, parseApiError } from "@/lib/toast-utils";
import ForgotPasswordPanel from "@/components/forms/forgot-password-panel";
import { LOGIN_PORTAL_MISMATCH_MESSAGE } from "@/lib/login-portal";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
type PortalType = "employee" | "transporter" | "client";
type AuthTab = "login" | "register";

const PORTAL_CONFIGS: Record<
  PortalType,
  {
    id: PortalType;
    categoryTag?: string;
    titleLines: string[];
    highlightLine: string;
    subtitle: string;
    bgImage: string;
    scriptText: string;
    features: { icon: any; title: string; desc: string }[];
    cardIcon: any;
    cardIconBg: string;
    cardIconColor: string;
    cardTitle: string;
    cardSubtitle: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    bottomNoticeType: "employee" | "transporter" | "client";
  }
> = {
  employee: {
    id: "employee",
    categoryTag: "INTERNAL OPERATIONS PORTAL",
    titleLines: ["People.", "Operations."],
    highlightLine: "A Stronger Network.",
    subtitle:
      "Access your workspace, manage operations, collaborate with teams and keep the logistics ecosystem moving.",
    bgImage: "/auth/employee-ops-bg.jpg",
    scriptText: "Behind Every Movement A Stronger Team.",
    features: [
      {
        icon: Users,
        title: "Streamline Operations",
        desc: "Manage indents, allocations and trips.",
      },
      {
        icon: BarChart3,
        title: "Real-time Insights",
        desc: "Monitor performance and take action.",
      },
      {
        icon: Network,
        title: "Collaborate Seamlessly",
        desc: "Stay aligned across teams and partners.",
      },
      {
        icon: ShieldCheck,
        title: "Drive Better Outcomes",
        desc: "Ensure compliance and operational excellence.",
      },
    ],
    cardIcon: Users,
    cardIconBg: "bg-[#EBF3FE]",
    cardIconColor: "text-[#1E40AF]",
    cardTitle: "Employee Login",
    cardSubtitle: "Access your ShunLink internal workspace",
    usernameLabel: "Email or Employee ID",
    usernamePlaceholder: "you@shunlink.com or EMP1234",
    bottomNoticeType: "employee",
  },
  transporter: {
    id: "transporter",
    categoryTag: "TRANSPORTER PORTAL",
    titleLines: ["More Loads."],
    highlightLine: "Stronger Partnerships.",
    subtitle:
      "Access available loads, manage your fleet and drivers, track trips and grow your business with ShunLink.",
    bgImage: "/auth/shunlink-hero-bg.jpg",
    scriptText: "Together We Move More Possibilities.",
    features: [
      {
        icon: Package,
        title: "Find Opportunities",
        desc: "Access verified loads and quotes.",
      },
      {
        icon: Truck,
        title: "Manage Operations",
        desc: "Manage vehicles, drivers and trips.",
      },
      {
        icon: TrendingUp,
        title: "Track Earnings",
        desc: "Get transparent and timely payments.",
      },
      {
        icon: BarChart3,
        title: "Build Long-term Growth",
        desc: "Be part of a trusted logistics network.",
      },
    ],
    cardIcon: Truck,
    cardIconBg: "bg-[#ECFDF5]",
    cardIconColor: "text-[#15803D]",
    cardTitle: "Transporter / Vendor",
    cardSubtitle: "Access loads, manage trips and grow with ShunLink.",
    usernameLabel: "Email or Phone",
    usernamePlaceholder: "you@company.com or 9876543210",
    bottomNoticeType: "transporter",
  },
  client: {
    id: "client",
    titleLines: ["Move your", "business forward"],
    highlightLine: "with confidence.",
    subtitle:
      "Create requirements, track shipments, manage documents and stay in control of your logistics — all in one place.",
    bgImage: "/auth/shunlink-hero-bg.jpg",
    scriptText: "Connected Logistics. Simplified.",
    features: [
      {
        icon: FileText,
        title: "Create & Manage",
        desc: "Raise requirements and track end-to-end movement.",
      },
      {
        icon: Truck,
        title: "Real-time Visibility",
        desc: "Stay updated at every mile.",
      },
      {
        icon: FileCheck2,
        title: "Documents & Compliance",
        desc: "Access PODs, invoices and reports.",
      },
      {
        icon: BarChart3,
        title: "Better Control",
        desc: "Monitor spend and improve your logistics performance.",
      },
    ],
    cardIcon: Building2,
    cardIconBg: "bg-[#FFF7ED]",
    cardIconColor: "text-[#C2410C]",
    cardTitle: "Client Portal",
    cardSubtitle: "Access or register your ShunLink TMS client account",
    usernameLabel: "Email or Phone",
    usernamePlaceholder: "you@company.com or 9876543210",
    bottomNoticeType: "client",
  },
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const portalParam = searchParams.get("portal")?.toLowerCase();
  const initialPortal: PortalType =
    portalParam === "client"
      ? "client"
      : portalParam === "vendor" || portalParam === "transporter"
      ? "transporter"
      : "employee";

  const initialTab: AuthTab =
    searchParams.get("mode") === "register" || searchParams.get("tab") === "register"
      ? "register"
      : "login";

  const [portal, setPortal] = useState<PortalType>(initialPortal);
  const [authTab, setAuthTab] = useState<AuthTab>(initialTab);
  const [isDriverMode, setIsDriverMode] = useState<boolean>(
    searchParams.get("mode") === "driver" && initialPortal === "transporter"
  );
  const [isForgotMode, setIsForgotMode] = useState<boolean>(false);

  // Standard Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Registration fields
  const [regCompanyName, setRegCompanyName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  // Driver OTP fields
  const [dlNumber, setDlNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (portalParam === "client") {
      setPortal("client");
      setIsDriverMode(false);
    } else if (portalParam === "vendor" || portalParam === "transporter") {
      setPortal("transporter");
    } else if (portalParam === "employee") {
      setPortal("employee");
      setIsDriverMode(false);
      setAuthTab("login");
    }
  }, [portalParam]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  function loginErrorMessage(error: string | undefined) {
    if (!error || error === "CredentialsSignin") return "Invalid email or password";
    if (error.includes(LOGIN_PORTAL_MISMATCH_MESSAGE) || error.includes("authorized")) {
      return LOGIN_PORTAL_MISMATCH_MESSAGE;
    }
    return error;
  }

  function loginPortalForUi(): "client" | "employee" | "vendor" {
    if (portal === "client") return "client";
    if (portal === "employee") return "employee";
    return "vendor";
  }

  async function goHomeAfterLogin() {
    const { resolvePostLoginPath } = await import("@/lib/vendor-quote-portal-url");
    const next = searchParams.get("next");
    const callbackUrl = searchParams.get("callbackUrl");
    const destRes = await fetch("/api/auth/post-login-destination");
    const dest = await destRes.json().catch(() => ({}));
    const fallback = typeof dest.path === "string" ? dest.path : "/";
    const path = resolvePostLoginPath(next, callbackUrl, fallback);
    router.push(path);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      loginPortal: loginPortalForUi(),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      const msg = loginErrorMessage(res.error);
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }
    toast.push({ title: "Signed in successfully", variant: "success" });
    await goHomeAfterLogin();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const role: "CLIENT" | "VENDOR" = portal === "client" ? "CLIENT" : "VENDOR";
    const payload = {
      role,
      companyName: regCompanyName,
      email: regEmail,
      phone: regPhone,
      password: regPassword,
    };

    const parsed = signupSchema.safeParse(payload);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Please check your details.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }

    setRegLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await readJsonBody(res);
    if (!res.ok) {
      setRegLoading(false);
      reportApiFailure(res, data, { toast, setError, fallback: "Registration failed. Please try again." });
      return;
    }

    // Automatically sign in upon registration
    const signInRes = await signIn("credentials", {
      email: regEmail,
      password: regPassword,
      loginPortal: role === "CLIENT" ? "client" : "vendor",
      redirect: false,
    });
    setRegLoading(false);

    if (signInRes?.error) {
      const msg = "Account created. Please sign in with your password.";
      toast.push({ title: msg, variant: "warning" });
      setAuthTab("login");
      setEmail(regEmail);
      return;
    }

    toast.push({ title: "Account created successfully", variant: "success" });
    if (role === "CLIENT") {
      router.push("/portal/client");
    } else {
      router.push("/portal/vendor");
    }
    router.refresh();
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
    const data = await readJsonBody(res);
    setLoading(false);
    if (!res.ok) {
      const err = reportApiFailure(res, data, { toast, setError, fallback: "Failed to send OTP" });
      if (err.retryAfter && err.retryAfter > 0) setResendCooldown(err.retryAfter);
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
      loginPortal: "driver",
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      const msg = loginErrorMessage(res.error) || "Incorrect OTP. Please try again.";
      setError(msg);
      toast.push({ title: msg, variant: "error" });
      return;
    }
    toast.push({ title: "Signed in successfully", variant: "success" });
    await goHomeAfterLogin();
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

  const cfg = PORTAL_CONFIGS[portal];
  const CardIcon = cfg.cardIcon;

  // Dynamic titles and subtitles based on active mode
  let displayCardTitle = cfg.cardTitle;
  let displayCardSubtitle = cfg.cardSubtitle;

  if (isForgotMode) {
    displayCardTitle = "Forgot Password";
    displayCardSubtitle = "Reset your account access credentials";
  } else if (isDriverMode) {
    displayCardTitle = "Driver Login";
    displayCardSubtitle = "Enter your Driving License & OTP to proceed";
  } else if (authTab === "register") {
    displayCardTitle = "Signup";
    if (portal === "client") {
      displayCardSubtitle = "Create your corporate shipping account";
    } else if (portal === "transporter") {
      displayCardSubtitle = "Join the verified ShunLink transporter network";
    }
  } else {
    if (portal === "client" || portal === "transporter") {
      displayCardTitle = "Signin";
      displayCardSubtitle =
        portal === "client"
          ? "Access your ShunLink TMS client workspace"
          : "Access loads, manage trips and grow with ShunLink";
    } else {
      displayCardTitle = "Employee Login";
      displayCardSubtitle = "Access your ShunLink internal workspace";
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#F8FAFC]">
      {/* =========================================================================
          LEFT PANE (Visual hero matching reference screenshots)
          ========================================================================= */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 text-white overflow-hidden bg-slate-950">
        {/* Background Image with Dark Vignette Gradient */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-105"
          style={{ backgroundImage: `url(${cfg.bgImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/35 to-transparent" />

        {/* Top: Logo & Category Header */}
        <div className="relative z-10">
          <div className="mb-8">
            <BrandLogo variant="dark" size="lg" href="/" />
          </div>

          {cfg.categoryTag && (
            <div className="flex items-center gap-2 mb-3">
              <span className="h-0.5 w-6 bg-[#F5D33C] rounded-full" />
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/80">
                {cfg.categoryTag}
              </span>
            </div>
          )}

          {/* Headline */}
          <h1 className="font-heading text-4xl xl:text-5xl font-extrabold text-white leading-[1.12] tracking-tight mb-4">
            {cfg.titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="text-[#F5D33C] block">{cfg.highlightLine}</span>
          </h1>

          <p className="text-white/80 text-base max-w-md leading-relaxed font-normal">
            {cfg.subtitle}
          </p>
        </div>

        {/* 4 Feature Items */}
        <div className="relative z-10 space-y-4 my-6 max-w-md">
          {cfg.features.map((f) => {
            const FIcon = f.icon;
            return (
              <div key={f.title} className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#F5D33C] shrink-0 shadow-sm">
                  <FIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-white leading-snug">{f.title}</p>
                  <p className="text-xs text-white/70 leading-snug">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Script Text & Curved Underline */}
        <div className="relative z-10 pt-4">
          <p className="font-script text-2xl xl:text-3xl text-white tracking-wide drop-shadow">
            {cfg.scriptText}
          </p>
          <svg
            className="w-40 h-2.5 text-[#F5D33C] mt-1"
            viewBox="0 0 160 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 7C50 2 110 2 157 6C110 3 55 4 3 8"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* =========================================================================
          RIGHT PANE (Login / Register Card)
          ========================================================================= */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 min-h-screen overflow-y-auto">
        {/* Top Header: Back Link */}
        <div className="mb-6">
          <Link
            href="/welcome"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-950 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to portal selection</span>
          </Link>
        </div>

        {/* Center: Main Elevated Card */}
        <div className="w-full max-w-[460px] mx-auto my-auto py-4">
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-[0_12px_40px_rgba(0,0,0,0.05)] p-7 sm:p-9">
            {/* Card Header: Icon Badge + Heading */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className={`h-14 w-14 rounded-2xl ${cfg.cardIconBg} ${cfg.cardIconColor} flex items-center justify-center shrink-0 shadow-sm`}
              >
                <CardIcon className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[22px] sm:text-[25px] font-bold text-gray-950 tracking-tight leading-none">
                  {displayCardTitle}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1.5 leading-snug">
                  {displayCardSubtitle}
                </p>
              </div>
            </div>

            {/* Sub-mode Tabs: shown for Client and Transporter when not in forgot or driver mode */}
            {!isForgotMode && !isDriverMode && portal !== "employee" && (
              <div className="flex rounded-xl bg-gray-100/80 p-1 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("login");
                    setError("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    authTab === "login"
                      ? "bg-white text-gray-950 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Signin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab("register");
                    setError("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                    authTab === "register"
                      ? "bg-white text-gray-950 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Signup
                </button>
              </div>
            )}

            {/* Error Message Alert */}
            {error && (
              <div className="mb-5 text-sm text-rose-700 bg-rose-50/80 border border-rose-200/80 rounded-xl px-4 py-3 leading-snug">
                {error}
              </div>
            )}

            {/* ================= FORGOT PASSWORD PANEL ================= */}
            {isForgotMode ? (
              <ForgotPasswordPanel
                initialEmail={email.includes("@") ? email : ""}
                onBack={() => {
                  setIsForgotMode(false);
                  setError("");
                }}
                onSuccess={(resetEmail) => {
                  setIsForgotMode(false);
                  setError("");
                  setPassword("");
                  if (resetEmail) setEmail(resetEmail);
                }}
              />
            ) : authTab === "register" ? (
              /* ================= REGISTER FORM (Client or Vendor) ================= */
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Company / Fleet Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                    {portal === "client" ? "Company Name" : "Business / Fleet Name"}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      {portal === "client" ? (
                        <Building2 className="h-4 w-4" />
                      ) : (
                        <Truck className="h-4 w-4" />
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={regCompanyName}
                      onChange={(e) => setRegCompanyName(e.target.value)}
                      placeholder={
                        portal === "client"
                          ? "Registered company name"
                          : "Registered fleet / agency name"
                      }
                      className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C] transition-all"
                    />
                  </div>
                </div>

                {/* Work Email */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                    Work Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C] transition-all"
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Phone className="h-4 w-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C] transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showRegPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-10 pr-11 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                      tabIndex={-1}
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full h-12 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {regLoading ? (
                    "Creating account..."
                  ) : (
                    <>
                      {portal === "client" ? "Create Account & Continue" : "Register Fleet & Continue"}{" "}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                  By registering you agree to submit accurate compliance & KYC documents for verification.
                </p>

                <div className="pt-2 text-center text-xs sm:text-sm text-gray-500">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthTab("login")}
                    className="text-[#1E3A8A] font-bold hover:underline"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            ) : isDriverMode ? (
              /* ================= DRIVER OTP LOGIN FORM ================= */
              <div className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                    Driving License Number
                  </label>
                  <input
                    type="text"
                    required
                    value={dlNumber}
                    onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MH0120200001234"
                    className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C]"
                  />
                </div>

                {!otpSent ? (
                  <form onSubmit={sendOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                        Registered Mobile Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60"
                    >
                      {loading ? "Sending OTP..." : "Send OTP →"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={verifyOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                        Enter 6-Digit OTP
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        className="w-full px-4 py-3 text-center text-lg tracking-widest font-mono bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60"
                    >
                      {loading ? "Verifying..." : "Verify & Sign In →"}
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || loading}
                      className="w-full text-xs text-gray-500 hover:text-gray-900 hover:underline disabled:opacity-50 text-center"
                    >
                      {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                    </button>
                  </form>
                )}

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDriverMode(false);
                      setError("");
                    }}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-950 hover:underline"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Standard Login
                  </button>
                </div>
              </div>
            ) : (
              /* ================= PASSWORD LOGIN FORM (Standard) ================= */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username / Email field */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                    {cfg.usernameLabel}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={cfg.usernamePlaceholder}
                      className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C] transition-all"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-800 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-11 py-3 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F5D33C]/30 focus:border-[#F5D33C] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        setError("");
                      }}
                      className="text-xs sm:text-sm font-medium text-[#1E3A8A] hover:text-blue-800 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                {/* Primary Button: Sign in → */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    "Signing in..."
                  ) : (
                    <>
                      Sign in <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Transporter only: Driver Login with OTP placed where Continue with SSO was */}
                {portal === "transporter" && (
                  <>
                    <div className="relative my-4 flex items-center justify-center">
                      <div className="w-full border-t border-gray-200" />
                      <span className="bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 absolute">
                        OR
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDriverMode(true);
                        setError("");
                      }}
                      className="w-full h-12 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors shadow-none"
                    >
                      <Truck className="h-4 w-4 text-emerald-700" />
                      Driver Login with OTP
                    </button>
                  </>
                )}

                {/* Bottom Notices */}
                <div className="pt-3">
                  {portal === "employee" && (
                    <div className="rounded-xl bg-[#F0F4F9]/70 border border-[#E2E8F0] p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-100/60 flex items-center justify-center text-blue-700 shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900 leading-tight">
                          Authorized access only
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                          For ShunLink employees and internal team members.
                        </p>
                      </div>
                    </div>
                  )}

                  {portal === "client" && (
                    <div className="text-center pt-2">
                      <p className="text-xs sm:text-sm text-gray-500">
                        Need help?{" "}
                        <Link
                          href="mailto:support@shunlink.in"
                          className="text-gray-950 font-bold hover:underline"
                        >
                          Contact Support
                        </Link>
                      </p>
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Footer on Right Pane */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-2 pt-6">
          <p>© 2024 ShunLink. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <Link href="#" className="hover:text-gray-600 transition-colors">
              Privacy Policy
            </Link>
            <span>|</span>
            <Link href="#" className="hover:text-gray-600 transition-colors">
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
