import SignOutButton from "@/components/sign-out-button";
import BrandLogo from "@/components/brand-logo";
import { CheckCircle2, Circle, Clock } from "lucide-react";

const STEPS = [
  { key: "account", label: "Account created" },
  { key: "kyc", label: "KYC & documents" },
  { key: "review", label: "Admin review" },
];

export default function OnboardingShell({
  roleLabel,
  userName,
  status,
  children,
}: {
  roleLabel: string;
  userName: string;
  status: string;
  children: React.ReactNode;
}) {
  const stepIndex =
    status === "SUBMITTED" || status === "APPROVED" || status === "REJECTED" ? 2 : 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <BrandLogo variant="light" size="sm" href="/login" className="hidden sm:flex shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                {roleLabel} onboarding
              </p>
              <h1 className="font-heading font-bold text-foreground text-lg truncate">
                Complete your compliance profile
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
            <span className="hidden sm:inline truncate max-w-[180px]">{userName}</span>
            <SignOutButton />
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-4">
          <div className="flex items-center gap-2 sm:gap-4">
            {STEPS.map((step, i) => {
              const done = i < stepIndex;
              const current = i === stepIndex;
              return (
                <div key={step.key} className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                      done
                        ? "bg-emerald-500 text-white"
                        : current
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : current ? (
                      <Clock className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span
                    className={`text-xs sm:text-sm truncate ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                  >
                    {step.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="hidden sm:block flex-1 h-px bg-border mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
