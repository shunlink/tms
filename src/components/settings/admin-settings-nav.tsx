import Link from "next/link";
import { adminNavLinkClass } from "./settings-styles";

export default function AdminSettingsNav({ active }: { active: "settings" | "security" | "portal" }) {
  return (
    <nav className="flex flex-wrap gap-2 mb-8 p-1">
      <Link
        href="/settings"
        className={active === "settings" ? "inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm" : adminNavLinkClass}
      >
        Company & preferences
      </Link>
      <Link
        href="/settings/security"
        className={active === "security" ? "inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm" : adminNavLinkClass}
      >
        Master OTP
      </Link>
      <Link
        href="/superadmin/portal-access"
        className={active === "portal" ? "inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm" : adminNavLinkClass}
      >
        Portal access
      </Link>
    </nav>
  );
}
