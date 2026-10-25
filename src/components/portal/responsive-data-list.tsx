import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Minimum width for horizontal scroll table mode on small screens */
  minTableWidth?: string;
};

/**
 * Wraps wide tables: horizontal scroll on mobile, full width on large screens.
 * Prefer card layouts in page markup; use this when a table must stay tabular.
 */
export default function ResponsiveDataList({
  children,
  className,
  minTableWidth = "min-w-[640px]",
}: Props) {
  return (
    <div className={cn("-mx-1 px-1 sm:mx-0 sm:px-0 overflow-x-auto overscroll-x-contain", className)}>
      <div className={cn("w-full", minTableWidth, "sm:min-w-0")}>{children}</div>
    </div>
  );
}
