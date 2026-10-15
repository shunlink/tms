import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "muted" | "outline";

const variants: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-transparent",
  success: "bg-green-100 text-green-800 border-transparent",
  warning: "bg-amber-100 text-amber-800 border-transparent",
  danger: "bg-red-100 text-red-800 border-transparent",
  info: "bg-blue-100 text-blue-800 border-transparent",
  muted: "bg-muted text-muted-foreground border-transparent",
  outline: "border-border text-foreground",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
