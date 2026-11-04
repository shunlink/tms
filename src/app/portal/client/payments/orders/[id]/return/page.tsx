import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import InboundPaymentReturnClient from "@/components/portal/inbound-payment-return-client";

export default async function InboundPaymentReturnPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.clientId) redirect("/login?portal=client");

  return <InboundPaymentReturnClient orderId={params.id} />;
}
