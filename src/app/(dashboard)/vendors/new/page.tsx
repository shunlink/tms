import VendorForm from "@/components/forms/vendor-form";

export default function NewVendorPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Add Vendor</h1>
        <p className="text-slate-500">Register a fleet owner or broker</p>
      </div>
      <VendorForm />
    </div>
  );
}
