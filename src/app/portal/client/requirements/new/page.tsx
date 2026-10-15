import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import RequirementForm from "@/components/forms/requirement-form";
import { getSessionUser } from "@/lib/auth";
import { getClientDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientNewRequirementPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  const client = await getClientDetail(user.clientId);
  if (!client) redirect("/portal/client");

  return (
    <div className="space-y-6 max-w-5xl w-full mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/portal/client/requirements"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-950 mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Requirements</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight leading-tight">
          Create Transport Requirement
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Raise a new vehicle requirement — your default pickup and consignor details are pre-filled below
        </p>
      </div>

      <RequirementForm
        clients={[{ id: client.id, name: client.name }]}
        lockClientName={client.name}
        clientMode
        consignorDefaults={{
          consignorName: client.contactName ?? client.name,
          consignorContact: client.contactName ?? "",
          consignorPhone: client.phone ?? "",
          consignorAddress: client.addressLine1 ?? client.billingAddress ?? "",
          consignorCity: client.city ?? "",
          consignorState: client.state ?? "",
          consignorPincode: client.pincode ?? "",
        }}
      />
    </div>
  );
}
