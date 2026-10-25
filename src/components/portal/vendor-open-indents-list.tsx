"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Truck, Calendar, Weight, MapPin } from "lucide-react";
import VendorQuoteForm from "@/components/forms/vendor-quote-form";
import PortalTableExport from "@/components/portal/portal-table-export";
import { formatDate, formatINR } from "@/lib/utils";

export type VendorOpenIndentRow = {
  id: string;
  indentNumber: string;
  client: string;
  status: string;
  advanceAmount: number | null;
  route: string;
  vehicleType: string;
  pickupAt: string | Date | null;
  weightValue: number | null;
  weightUnit: string;
  myQuote: {
    quotedRate: number;
    channel: string;
    submittedAt: string | Date;
  } | null;
};

export default function VendorOpenIndentsList({
  indents,
  highlightIndentId,
  fromWhatsApp,
}: {
  indents: VendorOpenIndentRow[];
  highlightIndentId?: string | null;
  fromWhatsApp?: boolean;
}) {
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightIndentId) return;
    const el = document.getElementById(`indent-${highlightIndentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlashId(highlightIndentId);
    const t = setTimeout(() => setFlashId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightIndentId, indents.length]);

  if (indents.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-2xs">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 border border-orange-100">
          <FileSpreadsheet className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-gray-950">No open indents</h3>
        <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          New loads are published when clients release requirements. Check back soon.
        </p>
      </div>
    );
  }

  const exportColumns = [
    { key: "indentNumber", header: "Indent" },
    { key: "client", header: "Client" },
    { key: "route", header: "Route" },
    { key: "vehicleType", header: "Vehicle Type" },
    { key: "pickupAt", header: "Pickup" },
    { key: "weight", header: "Weight" },
    { key: "myQuote", header: "My Quote" },
    { key: "status", header: "Status" },
  ];
  const exportRows = indents.map((indent) => ({
    indentNumber: indent.indentNumber,
    client: indent.client,
    route: indent.route,
    vehicleType: indent.vehicleType,
    pickupAt: indent.pickupAt ? formatDate(indent.pickupAt) : "",
    weight:
      indent.weightValue != null ? `${indent.weightValue} ${indent.weightUnit}` : "",
    myQuote: indent.myQuote ? formatINR(indent.myQuote.quotedRate) : "",
    status: indent.status,
  }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <PortalTableExport fileName="vendor-open-indents" columns={exportColumns} rows={exportRows} />
      </div>
      {fromWhatsApp && highlightIndentId && (
        <div className="rounded-2xl border border-[#F5D33C]/50 bg-[#F5D33C]/15 px-5 py-4 text-sm text-gray-900">
          You opened this load from WhatsApp — submit your freight rate below (or use the link in the message).
        </div>
      )}
      {indents.map((indent) => (
        <div
          key={indent.id}
          id={`indent-${indent.id}`}
          className={`bg-white rounded-2xl border shadow-2xs overflow-hidden transition-all hover:border-gray-200 ${
            flashId === indent.id
              ? "border-[#F5D33C] ring-2 ring-[#F5D33C]/40"
              : "border-gray-100/90"
          }`}
        >
          <div className="p-5 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-950">{indent.indentNumber}</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{indent.client}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold">
                {indent.status.replace(/_/g, " ")}
              </span>
              {indent.advanceAmount != null && (
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold">
                  Advance {formatINR(indent.advanceAmount)}
                </span>
              )}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {indent.advanceAmount != null && (
              <div className="text-xs sm:text-sm text-emerald-800 bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-4 py-3 mb-5 leading-relaxed">
                Advance for this load: <strong>{formatINR(indent.advanceAmount)}</strong>.
                {indent.advanceAmount > 0
                  ? " Paid per agreement after you are allocated."
                  : " No advance on this load."}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm mb-6">
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> Route
                </p>
                <p className="font-bold text-gray-950 text-xs sm:text-sm mt-1">{indent.route}</p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="h-3 w-3" /> Vehicle
                </p>
                <p className="font-bold text-gray-950 text-xs sm:text-sm mt-1">
                  {indent.vehicleType.replace(/_/g, " ")}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Pickup
                </p>
                <p className="font-bold text-gray-950 text-xs sm:text-sm mt-1">
                  {indent.pickupAt ? formatDate(indent.pickupAt) : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Weight className="h-3 w-3" /> Weight
                </p>
                <p className="font-bold text-gray-950 text-xs sm:text-sm mt-1">
                  {indent.weightValue != null ? `${indent.weightValue} ${indent.weightUnit}` : "—"}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <VendorQuoteForm indentId={indent.id} existingQuote={indent.myQuote} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
