import { redirect } from "next/navigation";
import PageHeader from "@/components/page-header";
import OnboardingRequestsTable from "@/components/onboarding/onboarding-requests-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { canAssignClientOnboardingRequests } from "@/lib/onboarding-request-access";
import {
  listAdminOnboardingRequests,
  listEmployeeOnboardingRequests,
} from "@/lib/services/onboarding.service";
import { hasPermission } from "@/lib/services/permission.service";

export const dynamic = "force-dynamic";

export default async function OnboardingRequestsPage() {
  const user = await getSessionUser();
  if (!user?.id) redirect("/login");
  const allowed =
    user.role === "SUPER_ADMIN" || (await hasPermission(user.id, "onboarding.ops"));
  if (!allowed) redirect("/");

  const canAssign = canAssignClientOnboardingRequests(user.role);
  const requests = canAssign
    ? await listAdminOnboardingRequests()
    : await listEmployeeOnboardingRequests(user.id);

  return (
    <div>
      <PageHeader
        title="Onboarding Requests"
        description={
          canAssign
            ? "Partial client applications awaiting assignment or employee follow-up."
            : "Clients assigned to you to complete onboarding and submit for admin approval."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {canAssign ? "All requests" : "My assignments"} ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OnboardingRequestsTable requests={requests} canAssign={canAssign} />
        </CardContent>
      </Card>
    </div>
  );
}
