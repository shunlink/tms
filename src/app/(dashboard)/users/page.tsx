import PageHeader from "@/components/page-header";
import UsersManagement from "@/components/users/users-management";
import { requirePagePermission } from "@/lib/page-auth";
import { getUsers, getFormOptions } from "@/lib/queries";
import { listTeams, suggestNextEmployeeCode } from "@/lib/services/employee.service";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requirePagePermission("users.manage");

  const [users, options, teams, suggestedEmployeeCode] = await Promise.all([
    getUsers(),
    getFormOptions(),
    listTeams(),
    suggestNextEmployeeCode(),
  ]);

  const teamRows = teams.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    memberCount: t._count.members,
  }));

  return (
    <div>
      <PageHeader
        title="Employees & Users"
        description="Provision internal employees and portal accounts (client, vendor, driver)"
      />

      <UsersManagement
        users={users}
        teams={teamRows}
        clients={options.clients}
        vendors={options.vendors}
        drivers={options.drivers}
        suggestedEmployeeCode={suggestedEmployeeCode}
        actorRole={user.role ?? "ADMIN"}
      />
    </div>
  );
}
