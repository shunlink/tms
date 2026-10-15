import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { PORTAL_THEME, type PortalAccent } from "@/lib/portal-theme";

export default function StatCard({
  icon: Icon,
  value,
  label,
  className,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  className?: string;
  accent?: PortalAccent;
}) {
  const iconClass = accent ? PORTAL_THEME[accent].statIcon : "bg-primary/10 text-primary";

  return (
    <Card className={cn("overflow-hidden border-border/80 shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardContent className="pt-5 sm:pt-6">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-heading text-base sm:text-lg font-bold text-foreground leading-snug break-words tabular-nums">
              {value}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
