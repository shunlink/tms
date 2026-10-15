import { redirect } from "next/navigation";

/** Bank transfers are initiated from balance/advance tasks; ledger lives under Vendor Payment Ledger. */
export default function OutboundPaymentsRedirect() {
  redirect("/payments");
}
