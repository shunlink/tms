import PlacementQueueGrid from "@/components/forms/placement-queue-grid";
import PageHeader from "@/components/page-header";
import { getSessionUser } from "@/lib/auth";
import { getPlacementQueue, getFormOptions } from "@/lib/queries";
import { hasPermission } from "@/lib/services/permission.service";

export const dynamic = "force-dynamic";

export default async function PlacementPage() {
  const [indents, { vendors }, user] = await Promise.all([
    getPlacementQueue(),
    getFormOptions(),
    getSessionUser(),
  ]);
  const canAct =
    user?.role === "SUPER_ADMIN" ||
    (user?.id ? await hasPermission(user.id, "placement.update") : false);

  return (
    <div>
      <PageHeader
        title="Placement"
        description="Allocated indents awaiting vehicle placement (24-hour timer)"
      />

      <PlacementQueueGrid indents={indents} vendors={vendors} canAct={canAct} />
    </div>
  );
}
