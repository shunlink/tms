"use client";

import { formatINR } from "@/lib/utils";
import {
  displayFromDetail,
  normalizeRequirementPayload,
  pickString,
} from "@/lib/bidding/requirement-display";

type LocationLike = {
  label?: string;
  city?: string;
  state?: string;
  pincode?: string;
  addressLine1?: string;
  partyName?: string;
};

function formatLocation(loc: LocationLike | undefined): string {
  if (!loc) return "—";
  const parts = [
    loc.label,
    loc.partyName,
    loc.addressLine1,
    [loc.city, loc.state].filter(Boolean).join(", "),
    loc.pincode,
  ].filter((p) => p && String(p).trim());
  return parts.length ? parts.map(String).join(" · ") : "—";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm text-slate-900 mt-0.5">{value ?? "—"}</p>
    </div>
  );
}

export default function RequirementReviewPanel({
  detail,
}: {
  detail: Record<string, unknown>;
}) {
  const flat = normalizeRequirementPayload(detail);
  const cargo = displayFromDetail(flat, null);

  const pickup = flat.pickup as LocationLike | undefined;
  const destination = flat.destination as LocationLike | undefined;
  const timing = flat.timing as { pickupAt?: string; deliveryBy?: string } | undefined;
  const clientContact = flat.clientContact as
    | {
        contactEmail?: string | null;
        contactPhone?: string | null;
        gstin?: string | null;
        city?: string | null;
        state?: string | null;
        registeredAddress?: string | null;
        tmsClientId?: string | null;
      }
    | undefined;

  const materialDescription = pickString(flat, ["materialDescription", "material"]);
  const vehicleRequirements = pickString(flat, ["vehicleRequirements"]);
  const additionalInstructions = pickString(flat, ["additionalInstructions"]);
  const clientBudgetInr = flat.clientBudgetInr as string | null | undefined;
  const pricingSnapshot = flat.pricingSnapshot as
    | { markupRate?: string; currencyCode?: string; snapshotAt?: string }
    | null
    | undefined;
  const singleTruck = flat.singleTruck !== false;

  const formatWhen = (iso?: string) => {
    if (!iso?.trim()) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Lane</h3>
          <Field label="Pickup" value={formatLocation(pickup) || cargo.origin} />
          <Field label="Destination" value={formatLocation(destination) || cargo.destination} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Schedule</h3>
          <Field label="Pickup at" value={formatWhen(timing?.pickupAt)} />
          <Field label="Deliver by" value={formatWhen(timing?.deliveryBy)} />
          <Field label="Load type" value={singleTruck ? "Single truck" : "Multiple trucks"} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Cargo</h3>
          <Field label="Material" value={materialDescription !== "—" ? materialDescription : cargo.material} />
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            <Field label="Quantity" value={cargo.quantityDisplay} />
            <Field label="Vehicle type" value={cargo.vehicleType} />
          </div>
          {vehicleRequirements !== "—" ? (
            <Field label="Vehicle requirements" value={vehicleRequirements} />
          ) : null}
          {additionalInstructions !== "—" ? (
            <Field label="Instructions" value={additionalInstructions} />
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Client</h3>
          <Field label="Name" value={cargo.clientName} />
          <Field label="Email" value={clientContact?.contactEmail} />
          <Field label="Phone" value={clientContact?.contactPhone} />
          <Field label="GSTIN" value={clientContact?.gstin} />
          <Field
            label="Location"
            value={[clientContact?.city, clientContact?.state].filter(Boolean).join(", ") || "—"}
          />
          {clientContact?.tmsClientId ? (
            <Field label="TMS client id" value={clientContact.tmsClientId} />
          ) : (
            <p className="text-xs text-amber-700 mt-2">TMS client link missing — onboarding sync required before indent.</p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Commercial (admin)</h3>
          {clientBudgetInr ? (
            <Field label="Client budget (private)" value={formatINR(Number(clientBudgetInr))} />
          ) : (
            <Field label="Client budget" value="Not provided" />
          )}
          {pricingSnapshot ? (
            <>
              <Field
                label="Markup at publish"
                value={`${pricingSnapshot.markupRate ?? "—"} (${pricingSnapshot.currencyCode ?? "INR"})`}
              />
              <Field label="Pricing locked" value={formatWhen(pricingSnapshot.snapshotAt)} />
            </>
          ) : (
            <Field label="Pricing snapshot" value="—" />
          )}
        </section>
      </div>
    </div>
  );
}
