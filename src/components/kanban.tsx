"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
export type KanbanColumn = { key: string; label: string };
export type KanbanItem = {
  id: string;
  column: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
};

export default function Kanban({
  columns,
  items,
  endpoint,
  method = "PATCH",
  bodyKey,
  extraBody,
}: {
  columns: KanbanColumn[];
  items: KanbanItem[];
  endpoint: string;
  method?: "PATCH" | "POST";
  bodyKey: string;
  extraBody?: Record<string, unknown>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [local, setLocal] = useState<KanbanItem[]>(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function move(id: string, column: string) {
    const item = local.find((i) => i.id === id);
    if (!item || item.column === column) return;
    const prev = local;
    setLocal((l) => l.map((i) => (i.id === id ? { ...i, column } : i)));
    const res = await fetch(endpoint.replace("{id}", id), {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [bodyKey]: column, ...(extraBody ?? {}) }),
    });
    const data = await readJsonBody(res);
    if (!res.ok) {
      setLocal(prev);
      reportApiFailure(res, data, { toast, fallback: "Move failed" });
      return;
    }
    toast.push({ title: "Updated", description: `${item.title} → ${column.replace(/_/g, " ")}`, variant: "success" });
    router.refresh();
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const colItems = local.filter((i) => i.column === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={() => {
              setOverCol(null);
              if (dragId) move(dragId, col.key);
              setDragId(null);
            }}
            className={cn(
              "min-w-[280px] w-[280px] shrink-0 rounded-xl border border-border bg-muted/50 p-4",
              overCol === col.key && "ring-2 ring-accent/50"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-foreground">{col.label}</span>
              <span className="text-sm font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">{colItems.length}</span>
            </div>
            <div className="space-y-3 min-h-[48px]">
              {colItems.map((it) => (
                <div
                  key={it.id}
                  draggable
                  onDragStart={() => setDragId(it.id)}
                  onDragEnd={() => setDragId(null)}
                  className={cn(
                    "rounded-xl border border-border bg-card p-4 shadow-sm cursor-grab active:cursor-grabbing",
                    dragId === it.id && "opacity-50"
                  )}
                >
                  {it.href ? (
                    <Link href={it.href} className="font-semibold text-base text-primary hover:underline">
                      {it.title}
                    </Link>
                  ) : (
                    <p className="font-semibold text-base text-foreground">{it.title}</p>
                  )}
                  {it.subtitle && <p className="text-sm text-muted-foreground mt-1">{it.subtitle}</p>}
                  {it.meta && <p className="text-sm text-foreground mt-1">{it.meta}</p>}
                </div>
              ))}
              {colItems.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Drop items here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
