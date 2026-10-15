import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PortalLoginCardProps = {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
};

export default function PortalLoginCard({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  children,
  className,
}: PortalLoginCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[440px] rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08)] p-8 sm:p-9",
        className
      )}
    >
      <div className="flex gap-4 items-start mb-8">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            iconClassName
          )}
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
