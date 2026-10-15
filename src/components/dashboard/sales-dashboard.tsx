import Link from "next/link";
import { FileSpreadsheet, Users, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import StatusBadge from "@/components/status-badge";
import PendingTasksSection from "@/components/dashboard/pending-tasks-section";
import ExpandableListCard from "@/components/expandable-list-card";
import type { SalesDashboardData } from "@/lib/team-dashboard-types";

export default function SalesDashboard({ data }: { data: SalesDashboardData }) {
  return (
    <div>
      <PageHeader
        title="Sales Dashboard"
        description="Client requirements, indents, and sales actions"
        action={
          <Link href="/requirements/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Requirement
            </Button>
          </Link>
        }
      />

      <div className="mb-8">
        <PendingTasksSection tasks={data.pendingTasks} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon={ClipboardList} value={data.openRequirements} label="Open Requirements" />
        <StatCard icon={FileSpreadsheet} value={data.indentsActive} label="Active Indents" />
        <StatCard icon={Users} value={data.clientsActive} label="Active Clients" />
      </div>

      <ExpandableListCard
        title="Recent Requirements"
        initialCount={5}
        viewAllHref="/requirements"
        emptyMessage="No open requirements."
      >
        {data.recentRequirements.map((req) => (
          <div key={req.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0">
            <div>
              <Link href={`/requirements/${req.id}`} className="font-semibold text-primary hover:underline">
                {req.reqNumber}
              </Link>
              <p className="text-sm text-muted-foreground mt-0.5">{req.client} · {req.route}</p>
            </div>
            <StatusBadge status={req.status} />
          </div>
        ))}
      </ExpandableListCard>
    </div>
  );
}
