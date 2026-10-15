import Link from "next/link";
import { Building2, Truck, ChevronRight } from "lucide-react";
import AuthShell from "@/components/auth-shell";
import { Card, CardContent } from "@/components/ui/card";
import { AUTH_BRANDING } from "@/lib/auth-branding";

const roles = [
  {
    href: "/signup/client",
    icon: Building2,
    title: "Client",
    desc: "Ship goods, raise requirements, track consignments & invoices",
    iconClass: "text-teal-700 bg-teal-50 border-teal-100",
    cardClass: "hover:border-teal-300 hover:bg-teal-50/30",
  },
  {
    href: "/signup/vendor",
    icon: Truck,
    title: "Vendor / Transporter",
    desc: "Quote on open indents, assign fleet, execute trips & upload POD",
    iconClass: "text-amber-800 bg-amber-50 border-amber-100",
    cardClass: "hover:border-amber-300 hover:bg-amber-50/30",
  },
];

export default function SignupHubPage() {
  return (
    <AuthShell
      brand={AUTH_BRANDING.CLIENT}
      title="Choose your account type"
      subtitle="Select how you'll use ShunLink TMS — each role has a dedicated registration flow"
      wide
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        {roles.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href} className="group block">
              <Card className={`transition-colors ${r.cardClass}`}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div
                    className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${r.iconClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{r.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{r.desc}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-2 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-6 text-center">
        Drivers are added by ShunLink operations — driver login is available on the sign-in page.
      </p>
    </AuthShell>
  );
}
