"use client";

import { CheckCircle2 } from "lucide-react";
import type { OnboardingPortalKind, OnboardingStep } from "@/lib/onboarding-progress";

export default function PortalOnboardingHero({
  kind,
  entityName,
  heroImage,
  steps,
}: {
  kind: OnboardingPortalKind;
  entityName: string;
  heroImage: string;
  steps: OnboardingStep[];
}) {
  const eyebrow = kind === "client" ? "CLIENT ONBOARDING" : "Welcome to ShunLink";
  const title =
    kind === "client"
      ? "Let's get your business on board 🤝"
      : "Let's get your business on board 👋";
  const subtitle =
    kind === "client"
      ? "Complete your profile so we can verify your details and get you access to seamless transportation."
      : "Complete your vendor profile so we can verify your details and get you access to loads and trips.";

  return (
    <section
      className="relative isolate overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm min-h-[240px] sm:min-h-[280px]"
      aria-label="Onboarding progress"
    >
      {/* Photo layer — same pattern as portal-auth-hero (bg-cover + absolute inset) */}
      <div
        className="absolute inset-0 z-0 bg-slate-300 bg-cover bg-no-repeat bg-right"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-hidden
      />

      {/* Readable copy on the left; scene stays visible on the right */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 32%, rgba(255,255,255,0.55) 48%, rgba(255,255,255,0.12) 62%, transparent 72%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 p-5 sm:p-7 pb-16 sm:pb-[4.5rem]">
        <p className="text-[10px] sm:text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight max-w-xl">
          {title}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-lg leading-relaxed">{subtitle}</p>
        {kind === "vendor" && entityName && (
          <p className="mt-1 text-xs font-semibold text-slate-500">{entityName}</p>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 sm:px-6 pb-4">
        <div className="rounded-xl bg-white/90 backdrop-blur border border-white/80 shadow-sm px-3 sm:px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 justify-between">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-2 min-w-0 flex-1">
                <StepDot step={step} index={i} kind={kind} />
                <div className="min-w-0 hidden sm:block">
                  <p className="text-[11px] font-semibold text-[#0F172A] truncate">{step.label}</p>
                  <p className="text-[10px] text-slate-500 capitalize">
                    {step.state === "complete"
                      ? "Completed"
                      : step.state === "current"
                        ? "In progress"
                        : "Pending"}
                  </p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block flex-1 h-px bg-slate-200 mx-1 min-w-[12px]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepDot({
  step,
  index,
  kind,
}: {
  step: OnboardingStep;
  index: number;
  kind: OnboardingPortalKind;
}) {
  if (step.state === "complete") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <CheckCircle2 className="h-4 w-4" />
      </span>
    );
  }
  if (step.state === "current") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E40AF] text-white text-sm font-bold">
        {kind === "vendor" && step.id === "account" ? "✓" : index + (kind === "client" ? 1 : 0)}
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 text-xs font-bold">
      {index + 1}
    </span>
  );
}
