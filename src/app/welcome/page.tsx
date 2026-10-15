import Link from "next/link";
import { redirect } from "next/navigation";
import { Truck, Users, ArrowRight } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Welcome to ShunLink TMS",
  description: "Transport management for shunlink.in partners",
};

const cards = [
  {
    href: "/signup/client",
    title: "I'm a Client",
    desc: "Book loads, track consignments, and manage invoices.",
    icon: Users,
    iconClass: "text-teal-700 bg-teal-50 border-teal-100",
    borderClass: "hover:border-teal-300 hover:bg-teal-50/30",
  },
  {
    href: "/signup/vendor",
    title: "I'm a Transporter",
    desc: "Quote on indents, assign fleet, and get paid faster.",
    icon: Truck,
    iconClass: "text-amber-800 bg-amber-50 border-amber-100",
    borderClass: "hover:border-amber-300 hover:bg-amber-50/30",
  },
];

export default function WelcomePage({
  searchParams,
}: {
  searchParams: { ref?: string; role?: string };
}) {
  if (searchParams.role === "client") redirect("/signup/client");
  if (searchParams.role === "vendor") redirect("/signup/vendor");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <BrandLogo
            variant="light"
            showSubtitle
            subtitle={searchParams.ref === "shunlink" ? "shunlink.in" : "Transport Management"}
            href="/welcome"
            size="lg"
            className="items-center mb-8"
          />
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Your logistics command centre
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            One platform for clients, transporters, and drivers — from requirement to POD to payment.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.href} href={c.href} className="group block">
                <Card className={`h-full transition-colors ${c.borderClass}`}>
                  <CardContent className="p-6">
                    <div
                      className={`inline-flex p-3 rounded-xl border mb-4 ${c.iconClass}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h2 className="font-heading font-semibold text-lg text-foreground mb-2">
                      {c.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">{c.desc}</p>
                    <span className="inline-flex items-center gap-1 text-sm text-primary font-medium group-hover:gap-2 transition-all">
                      Get started <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="text-center space-y-4">
          <Link href="/login">
            <Button variant="outline">Sign in to your account</Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
