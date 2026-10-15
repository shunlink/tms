import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatINR } from "@/lib/utils";
import type { FinanceMetricKind } from "@/lib/services/finance-dashboard.service";

const KIND_STYLES: Record<FinanceMetricKind, string> = {
  BOOKING: "bg-blue-100 text-blue-800",
  ACCRUAL: "bg-violet-100 text-violet-800",
  CASH: "bg-emerald-100 text-emerald-800",
  OUTSTANDING: "bg-amber-100 text-amber-800",
};

export default function FinanceMetricCard({
  label,
  amount,
  kind,
  href,
  icon: Icon,
}: {
  label: string;
  amount: number;
  kind: FinanceMetricKind;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const content = (
    <Card className={cn(href && "transition-shadow hover:shadow-md")}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              KIND_STYLES[kind]
            )}
          >
            {kind}
          </span>
        </div>
        <p className="font-heading text-2xl font-bold text-foreground mt-3">{formatINR(amount)}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}
