import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  /** Shown only when attention is true and value > 0 */
  badge?: number;
  /** Intro pulse + badge pop (only when open indents / actionable work exists) */
  attention?: boolean;
  className?: string;
};

export default function PortalAttentionCta({
  href,
  icon: Icon,
  children,
  badge,
  attention = false,
  className,
}: Props) {
  const showBadge = attention && badge != null && badge > 0;

  return (
    <Link
      href={href}
      className={cn(
        "relative z-10 inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-full text-xs sm:text-sm active:scale-[0.98]",
        "transition-[transform,filter,background-color] duration-200",
        attention
          ? cn(
              "portal-cta-intro bg-[#F5D33C] hover:bg-[#EAC72E] text-gray-950 font-bold hover:brightness-[1.02]"
            )
          : cn(
              "bg-white hover:bg-gray-50 text-gray-900 border border-gray-200/90 font-semibold shadow-2xs"
            ),
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span>{children}</span>
      {showBadge && (
        <span
          className={cn(
            "inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-gray-950 px-1.5 py-0.5 text-[10px] font-bold text-[#F5D33C] tabular-nums",
            "portal-cta-badge-pop"
          )}
          aria-label={`${badge} open`}
        >
          {badge! > 99 ? "99+" : badge}
        </span>
      )}
      {attention && (
        <ArrowRight className="portal-cta-arrow-intro h-4 w-4 shrink-0" aria-hidden />
      )}
    </Link>
  );
}
