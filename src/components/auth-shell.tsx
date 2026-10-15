import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { AuthBrandConfig } from "@/lib/auth-branding";
import BrandLogo from "@/components/brand-logo";

export default function AuthShell({
  brand,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  brand: AuthBrandConfig;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const steps = brand.steps.slice(0, 3);

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-sidebar">
      <div
        className={`hidden lg:flex flex-col justify-between p-12 text-white bg-gradient-to-br ${brand.accent}`}
      >
        <div>
          <BrandLogo variant="dark" showSubtitle subtitle="by shunlink.in" href="/login" size="lg" className="mb-12" />
          <h2 className="font-heading text-4xl font-bold leading-tight mb-4 max-w-lg">{brand.headline}</h2>
          <p className="text-white/80 text-lg max-w-md leading-relaxed">{brand.description}</p>
        </div>

        <div className="space-y-5 my-10">
          <p className="text-xs uppercase tracking-widest text-white/60 font-semibold">
            Getting started
          </p>
          {steps.map((step, i) => (
            <div key={step.title} className="flex gap-4 items-start">
              <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold shrink-0 border border-white/20">
                {i + 1}
              </div>
              <div>
                <p className="font-semibold text-base">{step.title}</p>
                <p className="text-sm text-white/70">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-sm text-white/50">
          Accounts are verified before full portal access is granted.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-background">
        <div className={`w-full ${wide ? "max-w-lg" : "max-w-md"}`}>
          <div className="mb-8 lg:hidden">
            <BrandLogo variant="light" showSubtitle subtitle="Transport Management" href="/login" />
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-sm p-8 sm:p-10">
            <div className="mb-8">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {title ?? brand.title}
              </h1>
              {subtitle && <p className="text-muted-foreground mt-2 text-base">{subtitle}</p>}
            </div>
            {children}
          </div>

          {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function AuthRoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    CLIENT: "Client account",
    VENDOR: "Vendor / Transporter",
    DRIVER: "Driver account",
  };
  const colors: Record<string, string> = {
    CLIENT: "text-teal-800 bg-teal-50 border-teal-200",
    VENDOR: "text-amber-900 bg-amber-50 border-amber-200",
    DRIVER: "text-violet-800 bg-violet-50 border-violet-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border ${colors[role] ?? "text-primary bg-primary/10 border-primary/20"}`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {labels[role] ?? role}
    </span>
  );
}

export const authInputClass =
  "w-full border border-input rounded-lg px-4 py-3 text-base bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-colors min-h-[48px]";

export const authLabelClass = "block text-sm font-semibold text-foreground mb-2";
