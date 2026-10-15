import ClientForm from "@/components/forms/client-form";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Add Client</h1>
        <p className="text-slate-500">Register a new client company</p>
      </div>
      <ClientForm />
    </div>
  );
}
