import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { redirectIfAuthenticated } from "@/lib/auth-redirect";
import {
  Truck,
  Building2,
  Users,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";

export const metadata = {
  title: "Choose your portal — ShunLink TMS",
  description: "Access your dedicated workspace to continue on ShunLink TMS",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: { ref?: string; role?: string };
}) {
  if (searchParams.role === "client") redirect("/signup/client");
  if (searchParams.role === "vendor") redirect("/signup/vendor");

  const user = await getSessionUser();
  await redirectIfAuthenticated(user);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#F8FAFC]">
      {/* =========================================================================
          LEFT PANE (Visual hero matching Image 1 exactly)
          ========================================================================= */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 text-white overflow-hidden bg-slate-950">
        {/* Background Image with Dark Vignette Gradient */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 scale-105"
          style={{ backgroundImage: `url(/auth/shunlink-hero-bg.jpg)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/35 to-transparent" />

        {/* Top: Logo & Category Header */}
        <div className="relative z-10">
          <div className="mb-8">
            <BrandLogo variant="dark" size="lg" href="/welcome" />
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="h-0.5 w-6 bg-[#F5D33C] rounded-full" />
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/80">
              TRANSPORT MANAGEMENT SYSTEM
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl xl:text-5xl font-extrabold text-white leading-[1.12] tracking-tight mb-4">
            A connected<br />
            workspace for<br />
            <span className="text-[#F5D33C]">every movement.</span>
          </h1>

          <p className="text-white/80 text-base max-w-md leading-relaxed font-normal">
            Manage transportation, track shipments, collaborate with partners, and keep your operations moving — all in one place.
          </p>
        </div>

        {/* 3 Feature Items */}
        <div className="relative z-10 space-y-4 my-8 max-w-md">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#F5D33C] shrink-0 shadow-sm">
              <Truck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white leading-snug">Simpler Operations</p>
              <p className="text-xs text-white/70 leading-snug">
                From requirements to delivery, manage it all seamlessly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#F5D33C] shrink-0 shadow-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white leading-snug">Real-time Visibility</p>
              <p className="text-xs text-white/70 leading-snug">
                Stay informed at every mile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#F5D33C] shrink-0 shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white leading-snug">A Stronger Ecosystem</p>
              <p className="text-xs text-white/70 leading-snug">
                Bring clients, vendors, drivers and teams together.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Script Text & Curved Underline */}
        <div className="relative z-10 pt-4">
          <p className="font-script text-2xl xl:text-3xl text-white tracking-wide drop-shadow">
            Every Move Connected.
          </p>
          <svg
            className="w-36 h-2.5 text-[#F5D33C] mt-1"
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
          RIGHT PANE (Portal Selection matching Image 1 exactly)
          ========================================================================= */}
      <div className="flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 min-h-screen overflow-y-auto">
        {/* Top spacer */}
        <div className="mb-6 h-6" />

        {/* Center: Main Portal Chooser */}
        <div className="w-full max-w-[500px] mx-auto my-auto py-4">
          {/* Tag */}
          <div className="flex items-center gap-2 mb-3">
            <span className="h-0.5 w-6 bg-[#F5D33C] rounded-full" />
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-gray-600">
              WELCOME TO SHUNLINK TMS
            </span>
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-gray-950 tracking-tight leading-tight mb-2">
            Choose your portal
          </h1>
          <p className="text-gray-500 text-sm sm:text-base mb-8">
            Access your dedicated workspace to continue.
          </p>

          {/* 3 Large Portal Cards */}
          <div className="space-y-4">
            {/* Card 1: Client */}
            <Link
              href="/login?portal=client"
              className="group block bg-[#FEFBF3] border border-[#FDE68A]/60 hover:border-[#F5D33C] rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0 shadow-2xs">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-950 group-hover:text-amber-900 transition-colors">
                      Client
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 leading-snug mt-0.5">
                      Manage requirements, track shipments, view documents and more.
                    </p>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#FEF3C7] text-[#92400E] group-hover:bg-[#F5D33C] group-hover:text-gray-950 flex items-center justify-center shrink-0 transition-all">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </Link>

            {/* Card 2: Employee */}
            <Link
              href="/login?portal=employee"
              className="group block bg-[#F0F7FF] border border-[#BFDBFE]/60 hover:border-[#3B82F6] rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 rounded-2xl bg-[#DBEAFE] text-[#1E40AF] flex items-center justify-center shrink-0 shadow-2xs">
                    <Users className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-950 group-hover:text-blue-900 transition-colors">
                      Employee
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 leading-snug mt-0.5">
                      Access internal operations, manage workflows and collaborate with teams.
                    </p>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#DBEAFE] text-[#1E3A8A] group-hover:bg-[#3B82F6] group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </Link>

            {/* Card 3: Vendor / Transporter */}
            <Link
              href="/login?portal=transporter"
              className="group block bg-[#F0FDF4] border border-[#BBF7D0]/60 hover:border-[#22C55E] rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 rounded-2xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0 shadow-2xs">
                    <Truck className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-950 group-hover:text-emerald-900 transition-colors">
                      Vendor / Transporter
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 leading-snug mt-0.5">
                      Access loads, manage trips, and coordinate operations.
                    </p>
                  </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#DCFCE7] text-[#166534] group-hover:bg-[#22C55E] group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                  <ChevronRight className="h-5 w-5" />
                </div>
              </div>
            </Link>
          </div>

          {/* Bottom Security Note */}
          <div className="mt-8 flex items-center gap-2.5 text-xs text-gray-500">
            <ShieldCheck className="h-4 w-4 text-gray-400 shrink-0" />
            <span>Secure access for a safer, smarter logistics ecosystem.</span>
          </div>
        </div>

        {/* Blank footer spacer to balance layout */}
        <div className="h-6" />
      </div>
    </div>
  );
}
