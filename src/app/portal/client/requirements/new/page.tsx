import { redirect } from "next/navigation";
import RequirementForm from "@/components/forms/requirement-form";
import PortalPageHeader from "@/components/portal/portal-page-header";
import { getSessionUser } from "@/lib/auth";
import { getClientDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientNewRequirementPage() {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login");

  const client = await getClientDetail(user.clientId);
  if (!client) redirect("/portal/client");

  return (
    <div className="max-w-2xl">
      <PortalPageHeader
        accent="client"
        title="New requirement"
        description="Raise a vehicle requirement — your pickup details are pre-filled"
      />
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
