import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Consistent spacing and safe-area padding for portal content pages. */
export default function PortalPage({ children, className }: Props) {
  return (
    <div
      className={cn(
        "space-y-4 sm:space-y-6 min-w-0 w-full pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      {children}
    </div>
  );
}
