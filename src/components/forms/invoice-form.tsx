"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";
import StatusBadge from "@/components/status-badge";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";

type LineDefaults = {
  tripId: string;
  lineKind?: "FREIGHT" | "LOADING" | "UNLOADING";
  amount: number;
  gstRate: number;
  gstAmount: number;
  description: string | null;
  lrNumber: string | null;
  routeFrom: string | null;
  routeTo: string | null;
  cargoSummary: string | null;
  vehicleReg: string | null;
  indentNumber: string | null;
};

type BillingDefaults = {
  billingName: string | null;
  billingGstin: string | null;
  billingAddress: string | null;
  billingEmail: string | null;
  paymentTermsDays: number | null;
};

type BillableTrip = {
  id: string;
  indentId: string | null;
  lrNumber: string;
  clientId: string;
  client: string;
  route: string;
  clientRate: number;
  podVerifiedAt: string | Date | null;
  invoiceTask: {
    id: string;
    status: string;
    deadlineAt: string | Date;
    slaBreached: boolean;
  } | null;
  billing: BillingDefaults;
  line: LineDefaults;
  lines: LineDefaults[];
};

function tripBillableTotal(trip: BillableTrip): number {
  if (trip.lines.length > 0) {
    return trip.lines.reduce((sum, line) => sum + line.amount, 0);
  }
  return trip.clientRate;
}

export default function InvoiceForm({
  trips,
  preselectIndentId,
}: {
  trips: BillableTrip[];
  preselectIndentId?: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [preselectDone, setPreselectDone] = useState(false);
  const [billing, setBilling] = useState<BillingDefaults | null>(null);
  const [lineEdits, setLineEdits] = useState<Record<string, Partial<LineDefaults>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (trip: BillableTrip) => {
    setSelected((s) => {
      const next = s.includes(trip.id) ? s.filter((x) => x !== trip.id) : [...s, trip.id];
      if (next.length > 0 && !s.includes(trip.id)) {
        setBilling(trip.billing);
      } else if (next.length === 0) {
        setBilling(null);
      }
      return next;
    });
  };

  const tripGroups = useMemo(() => {
    const map = new Map<string, BillableTrip[]>();
    for (const t of trips) {
      const key = t.line.indentNumber ?? "No indent";
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [trips]);

  useEffect(() => {
    if (!preselectIndentId || preselectDone || trips.length === 0) return;
    const matches = trips.filter((t) => t.indentId === preselectIndentId);
    if (matches.length === 0) {
      setPreselectDone(true);
      return;
    }
    const clientId = matches[0].clientId;
    const ids = matches.filter((t) => t.clientId === clientId).map((t) => t.id);
    if (ids.length > 0) {
      setSelected(ids);
      setBilling(matches[0].billing);
    }
    setPreselectDone(true);
  }, [preselectIndentId, preselectDone, trips]);

  function selectAllInGroup(groupTrips: BillableTrip[]) {
    const clientId = groupTrips[0]?.clientId;
    if (!clientId) return;
    const ids = groupTrips.map((t) => t.id);
    const selectedFromOtherClients = trips.some(
      (t) => selected.includes(t.id) && t.clientId !== clientId
    );
    if (selectedFromOtherClients) return;

    const allInGroupSelected = ids.every((id) => selected.includes(id));
    if (allInGroupSelected) {
      setSelected((s) => {
        const next = s.filter((id) => !ids.includes(id));
        if (next.length === 0) setBilling(null);
        return next;
      });
    } else {
      setSelected((s) => Array.from(new Set([...s, ...ids])));
      setBilling((b) => b ?? groupTrips[0].billing);
    }
  }

  const selectedTrips = trips.filter((t) => selected.includes(t.id));
  const gstRate = selectedTrips[0]?.line.gstRate ?? 0.18;

  const resolvedLines = selectedTrips.flatMap((t) => {
    const tripLines = t.lines?.length ? t.lines : [t.line];
    return tripLines.map((base) => {
      const key = `${t.id}:${base.lineKind ?? "FREIGHT"}`;
      const edits = lineEdits[key] ?? {};
      const amount = edits.amount ?? base.amount;
      const lineGstRate = edits.gstRate ?? base.gstRate;
      return {
        tripId: t.id,
        lineKind: base.lineKind ?? "FREIGHT",
        amount,
        gstRate: lineGstRate,
        gstAmount: Math.round(amount * lineGstRate * 100) / 100,
        description: edits.description ?? base.description,
        lrNumber: edits.lrNumber ?? base.lrNumber,
        routeFrom: edits.routeFrom ?? base.routeFrom,
        routeTo: edits.routeTo ?? base.routeTo,
        cargoSummary: edits.cargoSummary ?? base.cargoSummary,
        vehicleReg: edits.vehicleReg ?? base.vehicleReg,
        indentNumber: edits.indentNumber ?? base.indentNumber,
      };
    });
  });

  const subTotal = resolvedLines.reduce((s, l) => s + l.amount, 0);
  const gst = resolvedLines.reduce((s, l) => s + l.gstAmount, 0);
  const total = subTotal + gst;
  const clientIds = new Set(selectedTrips.map((t) => t.clientId));
  const mixedClients = clientIds.size > 1;
  const sameClient = selectedTrips.length > 0 && !mixedClients;

  function updateLine(lineKey: string, field: keyof LineDefaults, value: string | number) {
    setLineEdits((prev) => ({
      ...prev,
      [lineKey]: { ...prev[lineKey], [field]: value },
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (selected.length === 0) {
      setError("Select at least one trip");
      return;
    }
    if (mixedClients) {
      setError("All selected trips must belong to the same client");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedTrips[0].clientId,
        tripIds: selected,
        gstRate,
        billing,
        lines: resolvedLines,
      }),
    });
    setSaving(false);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, { toast, setError, fallback: "Failed to create invoice" });
      return;
    }
    const payload = data as { id?: string; data?: { id?: string } } | null;
    const invoiceId = payload?.id ?? payload?.data?.id;
    router.push(invoiceId ? `/invoices/${invoiceId}` : "/invoices");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trips Ready to Invoice (POD verified, trip closed)</CardTitle>
        </CardHeader>
        <CardContent>
          {trips.length === 0 && (
            <p className="text-sm text-slate-400">
              No trips ready to invoice. Trips become billable after POD is verified.
            </p>
          )}
          <div className="space-y-6">
            {tripGroups.map(([groupLabel, groupTrips]) => {
              const groupSubtotal = groupTrips.reduce((s, t) => s + tripBillableTotal(t), 0);
              const groupClientId = groupTrips[0]?.clientId;
              const selectionClientId = selectedTrips[0]?.clientId;
              const canSelectGroup =
                selected.length === 0 ||
                (selectionClientId != null && groupClientId === selectionClientId);
              const allSelected = groupTrips.every((t) => selected.includes(t.id));

              return (
                <div key={groupLabel} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{groupLabel}</p>
                      <p className="text-xs text-slate-500">
                        {groupTrips.length} trip{groupTrips.length === 1 ? "" : "s"} ·{" "}
                        {formatINR(groupSubtotal)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canSelectGroup}
                      onClick={() => selectAllInGroup(groupTrips)}
                      className="text-xs font-medium text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline"
                    >
                      {allSelected ? "Clear indent selection" : "Select all for this indent"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {groupTrips.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center justify-between border rounded-md p-3 hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(t.id)}
                            onChange={() => toggle(t)}
                            className="rounded"
                          />
                          <div>
                            <p className="font-medium text-sm text-blue-600">{t.lrNumber}</p>
                            <p className="text-xs text-slate-500">
                              {t.line.indentNumber ? `${t.line.indentNumber} · ` : ""}
                              {t.route} · {t.client}
                            </p>
                            {t.invoiceTask && (
                              <div className="flex items-center gap-2 mt-1">
                                <StatusBadge
                                  status={t.invoiceTask.slaBreached ? "SLA_BREACHED" : "PENDING"}
                                />
                                <span className="text-xs text-slate-400">
                                  Due {new Date(t.invoiceTask.deadlineAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="font-medium text-sm">{formatINR(tripBillableTotal(t))}</p>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {sameClient && billing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Client Billing (editable snapshot)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-slate-600">Billing name</span>
              <input
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={billing.billingName ?? ""}
                onChange={(e) => setBilling({ ...billing, billingName: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">GSTIN</span>
              <input
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={billing.billingGstin ?? ""}
                onChange={(e) => setBilling({ ...billing, billingGstin: e.target.value })}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-slate-600">Billing address</span>
              <input
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={billing.billingAddress ?? ""}
                onChange={(e) => setBilling({ ...billing, billingAddress: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Accounts email</span>
              <input
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={billing.billingEmail ?? ""}
                onChange={(e) => setBilling({ ...billing, billingEmail: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Payment terms (days)</span>
              <input
                type="number"
                className="mt-1 w-full border rounded-md px-3 py-2"
                value={billing.paymentTermsDays ?? 30}
                onChange={(e) =>
                  setBilling({ ...billing, paymentTermsDays: Number(e.target.value) })
                }
              />
            </label>
          </CardContent>
        </Card>
      )}

      {selectedTrips.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Line Items (editable snapshot)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTrips.flatMap((t) => {
              const tripLines = t.lines?.length ? t.lines : [t.line];
              return tripLines.map((base) => {
                const lineKey = `${t.id}:${base.lineKind ?? "FREIGHT"}`;
                const line = { ...base, ...lineEdits[lineKey] };
                const kindLabel =
                  base.lineKind === "LOADING"
                    ? "Loading"
                    : base.lineKind === "UNLOADING"
                      ? "Unloading"
                      : "Freight";
                return (
                <div key={lineKey} className="border rounded-md p-4 space-y-3">
                  <p className="font-medium text-sm">{t.lrNumber} — {kindLabel}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm">
                      <span className="text-slate-600">Origin</span>
                      <input
                        className="mt-1 w-full border rounded-md px-3 py-2"
                        value={line.routeFrom ?? ""}
                        onChange={(e) => updateLine(lineKey, "routeFrom", e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-600">Destination</span>
                      <input
                        className="mt-1 w-full border rounded-md px-3 py-2"
                        value={line.routeTo ?? ""}
                        onChange={(e) => updateLine(lineKey, "routeTo", e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-600">Vehicle</span>
                      <input
                        className="mt-1 w-full border rounded-md px-3 py-2"
                        value={line.vehicleReg ?? ""}
                        onChange={(e) => updateLine(lineKey, "vehicleReg", e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-600">Indent</span>
                      <input
                        className="mt-1 w-full border rounded-md px-3 py-2"
                        value={line.indentNumber ?? ""}
                        onChange={(e) => updateLine(lineKey, "indentNumber", e.target.value)}
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="text-slate-600">Cargo / description</span>
                      <input
                        className="mt-1 w-full border rounded-md px-3 py-2"
                        value={line.cargoSummary ?? line.description ?? ""}
                        onChange={(e) => updateLine(lineKey, "cargoSummary", e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-600">Amount</span>
                      <input
                        type="number"
                        className="mt-1 w-full border rounded-md px-3 py-2"
                        value={line.amount ?? base.amount}
                        onChange={(e) => updateLine(lineKey, "amount", Number(e.target.value))}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-slate-600">GST rate</span>
                      <input
                        type="number"
                        step="0.01"
                        className="mt-1 w-full border rounded-md px-3 py-2"
                        value={line.gstRate ?? gstRate}
                        onChange={(e) => updateLine(lineKey, "gstRate", Number(e.target.value))}
                      />
                    </label>
                  </div>
                </div>
              );
              });
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoice Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Freight Subtotal</span>
              <span className="font-medium">{formatINR(subTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">GST</span>
              <span className="font-medium">{formatINR(gst)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <span className="font-semibold">Total Invoice Amount</span>
              <span className="font-bold text-slate-900">{formatINR(total)}</span>
            </div>
            {mixedClients && (
              <p className="text-xs text-amber-600">Selected trips belong to different clients.</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600 pt-3">{error}</p>}
          <div className="flex gap-3 pt-6">
            <Button type="submit" disabled={!sameClient || saving}>
              {saving ? "Generating..." : "Generate GST Invoice"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
