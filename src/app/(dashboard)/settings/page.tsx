import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/page-header";
import { getActorSessionUser } from "@/lib/auth";

export default async function SettingsPage() {
  const actor = await getActorSessionUser();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        description="Company profile, GST and preferences"
      />

      <div className="space-y-6">
        {actor?.role === "SUPER_ADMIN" && (
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 space-y-2">
              <p>Master OTP and Superadmin employee portal access.</p>
              <Link href="/settings/security" className="text-teal-700 hover:underline font-medium">
                Open security settings
              </Link>
              {" · "}
              <Link href="/superadmin/portal-access" className="text-teal-700 hover:underline font-medium">
                Portal access
              </Link>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Your Transport Co." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Registered Address</label>
              <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PAN</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="AAAAA0000A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default GST % on Freight</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                <option>18% (GTA — Forward Charge)</option>
                <option>5% (GTA — No ITC)</option>
                <option>12%</option>
                <option>Exempt</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Numbering Series</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">LR Prefix</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" defaultValue="LR-2024-" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Prefix</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" defaultValue="INV-2024-" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Requirement Prefix</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" defaultValue="REQ-2024-" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Alert 30 days before vehicle insurance expiry",
              "Alert 30 days before fitness certificate expiry",
              "Alert 15 days before PUC expiry",
              "Alert 30 days before driver license expiry",
              "Alert when client exceeds credit limit",
              "Alert when POD pending more than 7 days",
            ].map((label) => (
              <label key={label} className="flex items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" defaultChecked className="rounded" />
                {label}
              </label>
            ))}
          </CardContent>
        </Card>

        <Button>Save Settings</Button>
      </div>
    </div>
  );
}
