"use client";

import Link from "next/link";
import {
  Shield,
  Zap,
  Lock,
  Headphones,
  ChevronRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import type { OnboardingPortalKind, OnboardingStep } from "@/lib/onboarding-progress";
import PortalOnboardingProgressRing from "./portal-onboarding-progress-ring";

const WHY_CLIENT = [
  { icon: Zap, text: "Faster onboarding and quicker access to transport services" },
  { icon: Shield, text: "Verified business profile for secure transactions" },
  { icon: Lock, text: "Compliance-ready documentation for seamless billing" },
  { icon: Headphones, text: "Dedicated support during your onboarding journey" },
];

const WHY_VENDOR = [
  { icon: Zap, text: "Access to verified loads and trip opportunities" },
  { icon: Shield, text: "Faster payments with verified compliance" },
  { icon: Lock, text: "Secure partner profile on the ShunLink network" },
  { icon: Headphones, text: "Long-term partnerships with leading shippers" },
];

export default function PortalOnboardingSidebar({
  kind,
  percent,
  steps,
  progressCaption,
}: {
  kind: OnboardingPortalKind;
  percent: number;
  steps: OnboardingStep[];
  progressCaption: string;
}) {
  const why = kind === "client" ? WHY_CLIENT : WHY_VENDOR;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-orange-50/40 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#0F172A] mb-3">Why we need this?</h3>
        <ul className="space-y-3">
          {why.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-2.5 text-xs text-slate-700 leading-relaxed">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-amber-600 shadow-sm">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#0F172A] mb-4">Your Progress</h3>
        <div className="flex flex-col items-center gap-3 mb-4">
          <PortalOnboardingProgressRing percent={percent} />
          <p className="text-xs text-center text-slate-600 leading-relaxed px-1">{progressCaption}</p>
        </div>
        <ul className="space-y-2">
          {steps.map((step) => (
            <li
              key={step.id}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs ${
                step.state === "current"
                  ? "bg-amber-50 border border-amber-100 text-[#0F172A] font-semibold"
                  : "text-slate-600"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                {step.state === "complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : step.state === "current" ? (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] text-[10px] font-bold text-white">
                    •
                  </span>
                ) : (
                  <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                )}
                <span className="truncate">{step.label}</span>
              </span>
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {step.state === "complete" ? "Completed" : step.state === "current" ? "In progress" : "Pending"}
              </span>
              {step.state === "current" && <ChevronRight className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600 mb-3">
            <Headphones className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-[#0F172A]">Need Help?</h3>
          <p className="text-xs text-slate-600 mt-1 mb-3 leading-relaxed">
            Our onboarding team is here to help you complete verification smoothly.
          </p>
          <Link
            href="mailto:founder@shunlink.in"
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
          >
            Contact Support <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
