import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PortalEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 sm:py-14 px-4 rounded-xl border border-dashed border-border bg-muted/20",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <p className="font-heading font-semibold text-foreground text-base">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
