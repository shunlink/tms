import VehicleForm from "@/components/forms/vehicle-form";
import { getFormOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  const { vendors } = await getFormOptions();
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Add Vehicle</h1>
        <p className="text-slate-500">Register a vendor&apos;s vehicle with document details</p>
      </div>
      <VehicleForm vendors={vendors} />
    </div>
  );
}
