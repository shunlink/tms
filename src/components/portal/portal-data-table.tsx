import { cn } from "@/lib/utils";

export function PortalTableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto -mx-1 px-1 scrollbar-none", className)}>{children}</div>
  );
}

export function PortalTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn("w-full text-sm min-w-[640px]", className)}>{children}</table>;
}

export const portalTheadRow = "border-b border-border text-left text-muted-foreground";
export const portalTh = "pb-3 pr-4 font-medium text-xs uppercase tracking-wide whitespace-nowrap";
export const portalTbodyRow =
  "border-b border-border/70 last:border-0 transition-colors hover:bg-muted/35";
export const portalTd = "py-3.5 pr-4 align-middle text-foreground";
export const portalTdMuted = "py-3.5 pr-4 align-middle text-muted-foreground";
export const portalTdStrong = "py-3.5 pr-4 align-middle font-semibold text-foreground";
