import Link from "next/link";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/status-badge";

export default function PortalOverviewRow({
  title,
  titleHref,
  subtitle,
  trailing,
  status,
  className,
}: {
  title: string;
  titleHref?: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  status?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-transparent px-3 py-3 -mx-3 transition-colors hover:bg-muted/40 hover:border-border/60",
        className
      )}
    >
      <div className="min-w-0">
        {titleHref ? (
          <Link href={titleHref} className="font-semibold text-primary hover:underline">
            {title}
          </Link>
        ) : (
          <p className="font-semibold text-foreground">{title}</p>
        )}
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {trailing}
        {status && <StatusBadge status={status} />}
      </div>
    </div>
  );
}
