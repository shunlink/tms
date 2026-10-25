import PartnerClientCreateFlow from "@/components/partners/partner-client-create-flow";
import { requirePagePermission } from "@/lib/page-auth";

export default async function NewClientPage() {
  await requirePagePermission("client.edit");
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Add Client</h1>
        <p className="text-slate-500">
          Onboard a client with the same profile, documents, agreement, and portal access as self-service registration.
        </p>
      </div>
      <PartnerClientCreateFlow />
    </div>
  );
}
