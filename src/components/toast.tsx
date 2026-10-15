"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";
export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};
type Toast = ToastInput & { id: number; variant: ToastVariant };

const ToastContext = createContext<{ push: (t: ToastInput) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, variant: t.variant ?? "default", ...t }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex w-[min(100vw-2rem,24rem)] flex-col gap-3">
        {items.map((t) => {
          const Icon = icons[t.variant];
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border-2 bg-card p-4 shadow-lg",
                t.variant === "success" && "border-green-200 bg-green-50",
                t.variant === "error" && "border-red-200 bg-red-50",
                t.variant === "warning" && "border-amber-200 bg-amber-50",
                (t.variant === "default" || t.variant === "info") && "border-border"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  t.variant === "success" && "text-green-700",
                  t.variant === "error" && "text-red-700",
                  t.variant === "warning" && "text-amber-800",
                  (t.variant === "default" || t.variant === "info") && "text-primary"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground">{t.title}</p>
                {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
              </div>
              <button
                onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
