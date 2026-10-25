import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy URL — assisted waiting state removed. */
export default function ClientAssistedWaitingPage() {
  redirect("/onboard/client");
}
