import { notFound } from "next/navigation";
import VehicleForm from "@/components/forms/vehicle-form";
import { getVehicleDetail, getFormOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";

const d = (date: Date | null | undefined) =>
  date ? new Date(date).toISOString().slice(0, 10) : "";

export default async function EditVehiclePage({ params }: { params: { id: string } }) {
  const [v, options] = await Promise.all([
    getVehicleDetail(params.id),
    getFormOptions(),
  ]);
  if (!v) notFound();

  const initial = {
    registrationNumber: v.number ?? "",
    type: v.type ?? "TRUCK_17FT",
    bodyType: v.bodyType ?? "",
    capacity: v.capacity ?? "",
    capacityTons: v.capacityTons != null ? String(v.capacityTons) : "",
    make: v.make ?? "",
    model: v.model ?? "",
    year: v.year != null ? String(v.year) : "",
    ownership: v.ownership ?? "ATTACHED",
    rcNumber: v.rcNumber ?? "",
    rcExpiry: d(v.rcExpiry),
    ownerName: v.ownerName ?? "",
    ownerPan: v.ownerPan ?? "",
    insuranceNumber: v.insuranceNumber ?? "",
    insuranceCompany: v.insuranceCompany ?? "",
    insuranceExpiry: d(v.insuranceExpiry),
    insuranceValue: v.insuranceValue != null ? String(v.insuranceValue) : "",
    fitnessExpiry: d(v.fitnessExpiry),
    pucNumber: v.pucNumber ?? "",
    pucExpiry: d(v.pucExpiry),
    permitType: v.permitType ?? "",
    permitNumber: v.permitNumber ?? "",
    permitExpiry: d(v.permitExpiry),
    gpsDeviceId: v.gpsDeviceId ?? "",
    fastagId: v.fastagId ?? "",
    remarks: v.remarks ?? "",
    vendorId: v.vendor?.id ?? "",
    gpsEnabled: v.gpsEnabled,
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Edit Vehicle</h1>
        <p className="text-slate-500">{v.number}</p>
      </div>
      <VehicleForm vendors={options.vendors} initial={initial} vehicleId={v.id} />
    </div>
  );
}
