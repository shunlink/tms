import { cn } from "@/lib/utils";
import { PORTAL_THEME, type PortalAccent } from "@/lib/portal-theme";

export default function PortalPageHeader({
  title,
  description,
  action,
  accent = "vendor",
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  accent?: PortalAccent;
  className?: string;
}) {
  const theme = PORTAL_THEME[accent];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8",
        className
      )}
    >
      <div className={cn("min-w-0 pl-4 border-l-4", theme.titleAccent)}>
        <h1 className="font-heading text-2xl sm:text-[1.75rem] font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1.5 text-base leading-relaxed max-w-2xl">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
