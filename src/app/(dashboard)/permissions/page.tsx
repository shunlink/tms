import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/page-auth";
import { PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/services/permission.service";

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "SALES", "OPERATIONS", "FINANCE", "VENDOR_TEAM", "CLIENT", "VENDOR", "DRIVER"];

export default async function PermissionsPage() {
  await requirePagePermission("permissions.manage");
  const rolePerms = await prisma.rolePermission.findMany({ include: { permission: true } });
  const grantedByRole: Record<string, Set<string>> = {};
  for (const rp of rolePerms) {
    (grantedByRole[rp.role] ??= new Set()).add(rp.permission.key);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
        <p className="text-muted-foreground">Permission matrix — SUPER_ADMIN has unrestricted access</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Permission Matrix</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Permission</th>
                  {ROLES.map((r) => <th key={r} className="pb-3 px-2 font-medium">{r}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_KEYS.map((key) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{key}</td>
                    {ROLES.map((r) => {
                      const granted = grantedByRole[r]?.has(key) ?? (DEFAULT_ROLE_PERMISSIONS[r] ?? []).includes(key);
                      return (
                        <td key={r} className="py-2 px-2 text-center">
                          {granted ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
