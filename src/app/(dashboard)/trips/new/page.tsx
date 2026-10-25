import TripForm from "@/components/forms/trip-form";
import { getFormOptions, getRequirementsForSelect } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const [options, requirements] = await Promise.all([
    getFormOptions(),
    getRequirementsForSelect(),
  ]);

  const one = (k: string) => {
    const v = searchParams?.[k];
    return Array.isArray(v) ? v[0] : v;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Create Trip</h1>
        <p className="text-slate-500">
          Allocate a vendor vehicle to a client requirement and generate LR
        </p>
      </div>
      <TripForm
        clients={options.clients}
        vendors={options.vendors}
        vehicles={options.vehicles}
        drivers={options.drivers}
        requirements={requirements.map((r) => ({
          id: r.id,
          reqNumber: r.reqNumber,
          routeFrom: r.routeFrom,
          routeTo: r.routeTo,
        }))}
        defaults={{
          requirementId: one("requirementId"),
          clientId: one("clientId"),
          vendorId: one("vendorId"),
          vehicleId: one("vehicleId"),
          routeFrom: one("routeFrom"),
          routeTo: one("routeTo"),
        }}
      />
    </div>
  );
}
