import DriverForm from "@/components/forms/driver-form";

export default function NewDriverPage() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Add Driver</h1>
        <p className="text-slate-500">Register a driver with license details</p>
      </div>
      <DriverForm />
    </div>
  );
}
