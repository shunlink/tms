import { cn } from "@/lib/utils";
import { formatPendingCount } from "@/lib/sidebar-pending-keys";

export default function NavBadge({
  count,
  className,
  variant = "sidebar",
}: {
  count: number;
  className?: string;
  variant?: "sidebar" | "portal";
}) {
  const label = formatPendingCount(count);
  if (!label) return null;

  return (
    <span
      className={cn(
        "ml-auto shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums leading-none",
        variant === "sidebar"
          ? "bg-accent text-accent-foreground shadow-sm"
          : "bg-accent text-white",
        className
      )}
      aria-label={`${count} pending`}
    >
      {label}
    </span>
  );
}
