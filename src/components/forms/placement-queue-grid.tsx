"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import PlacementQueueCard from "@/components/forms/placement-queue-card";

type PlacementItem = {
  id: string;
  indentNumber: string;
  client: string;
  route: string;
  vendor: string | null;
  allocatedAt: string | Date | null;
  deadlineAt: string | Date | null;
  placementStatus: string | null;
  status: string;
  placementProgress?: string;
  vehicleQuantity?: number;
};

export default function PlacementQueueGrid({
  indents,
  vendors,
  canAct,
}: {
  indents: PlacementItem[];
  vendors: Array<{ id: string; name: string }>;
  canAct: boolean;
}) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return indents.filter((item) => {
      const matchesClient = !q || item.client.toLowerCase().includes(q);
      const matchesDate =
        !dateFilter ||
        (item.allocatedAt &&
          new Date(item.allocatedAt).toISOString().slice(0, 10) === dateFilter);
      return matchesClient && matchesDate;
    });
  }, [indents, search, dateFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by client name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="sm:w-48"
          aria-label="Filter by allocation date"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">
          {indents.length === 0
            ? "No indents awaiting placement."
            : "No placements match your search."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="aspect-square min-h-[280px]">
              <PlacementQueueCard item={item} vendors={vendors} canAct={canAct} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
