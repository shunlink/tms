"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type VendorOption = { id: string; name: string };
type ClientOption = { id: string; name: string };

export default function PayablesFilters({
  vendors,
  clients,
}: {
  vendors: VendorOption[];
  clients: ClientOption[];
}) {
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
      params.delete("page");
      startTransition(() => {
        router.push(`/payables?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setParams({
      vendorId: String(fd.get("vendorId") ?? ""),
      clientId: String(fd.get("clientId") ?? ""),
      status: String(fd.get("status") ?? ""),
      payableType: String(fd.get("payableType") ?? ""),
      ageingBucket: String(fd.get("ageingBucket") ?? ""),
      dateFrom: String(fd.get("dateFrom") ?? ""),
      dateTo: String(fd.get("dateTo") ?? ""),
      tripLr: String(fd.get("tripLr") ?? ""),
      minOutstanding: String(fd.get("minOutstanding") ?? ""),
      maxOutstanding: String(fd.get("maxOutstanding") ?? ""),
    });
  };

  const clearFilters = () => {
    startTransition(() => router.push("/payables"));
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="vendorId">Vendor</Label>
        <Select id="vendorId" name="vendorId" defaultValue={searchParams.get("vendorId") ?? ""}>
          <option value="">All vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clientId">Client</Label>
        <Select id="clientId" name="clientId" defaultValue={searchParams.get("clientId") ?? ""}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">Payment status</Label>
        <Select id="status" name="status" defaultValue={searchParams.get("status") ?? ""}>
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="ACTION_REQUIRED">Action required</option>
          <option value="SLA_BREACHED">SLA breached</option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="payableType">Payable type</Label>
        <Select id="payableType" name="payableType" defaultValue={searchParams.get("payableType") ?? ""}>
          <option value="">Advance & balance</option>
          <option value="ADVANCE">Advance</option>
          <option value="BALANCE">Balance</option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ageingBucket">Ageing bucket</Label>
        <Select id="ageingBucket" name="ageingBucket" defaultValue={searchParams.get("ageingBucket") ?? ""}>
          <option value="">All buckets</option>
          <option value="current">Current</option>
          <option value="d1_30">1–30 days</option>
          <option value="d31_60">31–60 days</option>
          <option value="d61_90">61–90 days</option>
          <option value="d90plus">90+ days</option>
          <option value="overdue">Any aged</option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tripLr">Trip / LR</Label>
        <Input
          id="tripLr"
          name="tripLr"
          placeholder="LR number"
          defaultValue={searchParams.get("tripLr") ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dateFrom">Ageing from</Label>
        <Input id="dateFrom" name="dateFrom" type="date" defaultValue={searchParams.get("dateFrom") ?? ""} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dateTo">Ageing to</Label>
        <Input id="dateTo" name="dateTo" type="date" defaultValue={searchParams.get("dateTo") ?? ""} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="minOutstanding">Min outstanding (₹)</Label>
        <Input
          id="minOutstanding"
          name="minOutstanding"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          defaultValue={searchParams.get("minOutstanding") ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="maxOutstanding">Max outstanding (₹)</Label>
        <Input
          id="maxOutstanding"
          name="maxOutstanding"
          type="number"
          min="0"
          step="0.01"
          placeholder="Any"
          defaultValue={searchParams.get("maxOutstanding") ?? ""}
        />
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Filtering…" : "Apply filters"}
        </Button>
        <Button type="button" variant="outline" onClick={clearFilters} disabled={pending}>
          Clear
        </Button>
      </div>
    </form>
  );
}
