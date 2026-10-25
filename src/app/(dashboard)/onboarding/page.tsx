import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OnboardingActions from "@/components/forms/onboarding-actions";
import PageHeader from "@/components/page-header";
import StatusBadge from "@/components/status-badge";
import { getSessionUser } from "@/lib/auth";
import { getOnboardingQueue } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  subtitle?: string;
  onboardingStatus: string;
  onboardingRemarks: string | null;
  createdAt: Date;
  createdByLabel?: string | null;
};

function Section({
  title,
  type,
  rows,
  isAdmin,
  hrefPrefix,
}: {
  title: string;
  type: string;
  rows: Row[];
  isAdmin: boolean;
  hrefPrefix: string;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{title} ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Remarks</th>
              <th className="pb-3 font-medium">Created</th>
              <th className="pb-3 font-medium">Created by</th>
              <th className="pb-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  Nothing pending.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="py-3 font-medium text-slate-900">
                  <Link href={`${hrefPrefix}/${r.id}`} className="hover:text-blue-600 hover:underline">
                    {r.name}
                  </Link>
                  {r.subtitle && <span className="text-slate-400"> · {r.subtitle}</span>}
                </td>
                <td className="py-3">
                  <StatusBadge status={r.onboardingStatus} />
                </td>
                <td className="py-3 text-slate-600">{r.onboardingRemarks ?? "—"}</td>
                <td className="py-3 text-slate-600">{formatDate(r.createdAt)}</td>
                <td className="py-3 text-slate-600">{r.createdByLabel ?? "—"}</td>
                <td className="py-3">
                  {isAdmin ? (
                    <OnboardingActions type={type} id={r.id} name={r.name} />
                  ) : (
                    <span className="text-xs text-slate-400">Admin approval required</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default async function OnboardingQueuePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user.role ?? "");

  const { clients, vendors, vehicles } = await getOnboardingQueue();

  const total = clients.length + vendors.length + vehicles.length;

  return (
    <div>
      <PageHeader
        title="Onboarding Approvals"
        description={`${total} record(s) awaiting approval. Admin or Super Admin can approve.`}
      />

      <Section
        title="Clients"
        type="client"
        hrefPrefix="/clients"
        isAdmin={isAdmin}
        rows={clients.map((c) => ({
          id: c.id,
          name: c.name,
          onboardingStatus: c.onboardingStatus,
          onboardingRemarks: c.onboardingRemarks,
          createdAt: c.createdAt,
          createdByLabel: c.createdByLabel,
        }))}
      />
      <Section
        title="Vendors"
        type="vendor"
        hrefPrefix="/vendors"
        isAdmin={isAdmin}
        rows={vendors.map((v) => ({
          id: v.id,
          name: v.name,
          onboardingStatus: v.onboardingStatus,
          onboardingRemarks: v.onboardingRemarks,
          createdAt: v.createdAt,
        }))}
      />
      <Section
        title="Vehicles"
        type="vehicle"
        hrefPrefix="/vehicles"
        isAdmin={isAdmin}
        rows={vehicles.map((v) => ({
          id: v.id,
          name: v.name,
          onboardingStatus: v.onboardingStatus,
          onboardingRemarks: v.onboardingRemarks,
          createdAt: v.createdAt,
        }))}
      />
    </div>
  );
}
