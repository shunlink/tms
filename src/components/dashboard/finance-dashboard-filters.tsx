"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { TRIP_STATUSES } from "@/lib/dashboard-metrics";

type FilterOptions = {
  clients: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  trips: { id: string; lrNumber: string }[];
};

export default function FinanceDashboardFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/?${qs}` : "/");
      });
    },
    [router, searchParams]
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setParams({
      from: String(fd.get("from") ?? ""),
      to: String(fd.get("to") ?? ""),
      clientId: String(fd.get("clientId") ?? ""),
      vendorId: String(fd.get("vendorId") ?? ""),
      tripId: String(fd.get("tripId") ?? ""),
      status: String(fd.get("status") ?? ""),
    });
  };

  const clearFilters = () => {
    startTransition(() => router.push("/"));
  };

  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        <form
          key={searchParams.toString()}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
          onSubmit={onSubmit}
        >
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" type="date" defaultValue={searchParams.get("from") ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" type="date" defaultValue={searchParams.get("to") ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientId">Client</Label>
            <Select id="clientId" name="clientId" defaultValue={searchParams.get("clientId") ?? ""}>
              <option value="">All clients</option>
              {options.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendorId">Vendor</Label>
            <Select id="vendorId" name="vendorId" defaultValue={searchParams.get("vendorId") ?? ""}>
              <option value="">All vendors</option>
              {options.vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tripId">Trip</Label>
            <Select id="tripId" name="tripId" defaultValue={searchParams.get("tripId") ?? ""}>
              <option value="">All trips</option>
              {options.trips.map((t) => (
                <option key={t.id} value={t.id}>{t.lrNumber}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={searchParams.get("status") ?? ""}>
              <option value="">All statuses</option>
              {TRIP_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <Button type="submit" disabled={pending}>
              {pending ? "Filtering…" : "Apply filters"}
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters} disabled={pending}>
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
