import RequirementForm from "@/components/forms/requirement-form";
import { getFormOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NewRequirementPage() {
  const { clients } = await getFormOptions();
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Requirement</h1>
        <p className="text-slate-500">Record a vehicle requirement from a client</p>
      </div>
      <RequirementForm clients={clients} />
    </div>
  );
}
