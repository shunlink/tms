import { redirect } from "next/navigation";
import { FileSpreadsheet, Truck, Calendar, Weight, MapPin } from "lucide-react";
import VendorQuoteForm from "@/components/forms/vendor-quote-form";
import { getSessionUser } from "@/lib/auth";
import { getVendorOpenIndents } from "@/lib/queries";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorOpenIndentsPage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login?portal=transporter");

  const indents = await getVendorOpenIndents(user.vendorId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Open Indents
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Submit your best rate. One quote per indent — first valid submission wins.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200/60">
          <FileSpreadsheet className="h-4 w-4" />
          <span>{indents.length} Available</span>
        </div>
      </div>

      {indents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-2xs">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 border border-orange-100">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-gray-950">No open indents</h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            New loads are published when clients release requirements. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {indents.map((indent) => (
            <div
              key={indent.id}
              className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs overflow-hidden transition-all hover:border-gray-200"
            >
              <div className="p-5 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-950">
                    {indent.indentNumber}
                  </h3>
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-6">
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
                      {indent.weightValue != null
                        ? `${indent.weightValue} ${indent.weightUnit}`
                        : "—"}
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
      )}
    </div>
  );
}
