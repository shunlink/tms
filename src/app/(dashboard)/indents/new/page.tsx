import Link from "next/link";
import IndentForm from "@/components/forms/indent-form";
import { getFormOptions } from "@/lib/queries";
import { getRequirementPrefill } from "@/lib/services/indent.service";

export const dynamic = "force-dynamic";

export default async function NewIndentPage({
  searchParams,
}: {
  searchParams: { requirementId?: string };
}) {
  const { clients } = await getFormOptions();
  const requirementId = searchParams.requirementId;

  let prefill = null;
  if (requirementId) {
    prefill = await getRequirementPrefill(requirementId);
  }

  if (prefill?.alreadyConverted && prefill.indentId) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Requirement already converted</h1>
        <p className="text-slate-500 mb-4">
          {prefill.reqNumber} has already been converted to an indent.
        </p>
        <Link href={`/indents/${prefill.indentId}`} className="text-blue-600 hover:underline">
          Open indent →
        </Link>
      </div>
    );
  }

  const lockedClientId = prefill?.clientId ?? undefined;
  const lockClientName = prefill?.clientName ?? undefined;

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {prefill ? `New Indent from ${prefill.reqNumber}` : "New Indent"}
        </h1>
        <p className="text-slate-500">
          {prefill
            ? "Review the prefilled requirement data and save when ready."
            : "Capture the client requirement in detail"}
        </p>
      </div>
      <IndentForm
        clients={clients}
        mode="create"
        requirementId={requirementId}
        initialValues={prefill?.values}
        lockedClientId={lockedClientId}
        lockClientName={lockClientName}
      />
    </div>
  );
}
