import AccessRolesManagement from "@/components/access-roles/access-roles-management";
import { requirePagePermission } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function AccessRolesPage() {
  await requirePagePermission("roles.manage");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Access role bundles</h1>
        <p className="text-muted-foreground">
          Named permission bundles assigned to employees (HashTMS-style access roles)
        </p>
      </div>
      <AccessRolesManagement />
    </div>
  );
}
