import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import PortalNav from "@/components/portal-nav";
import BrandLogo from "@/components/brand-logo";
import PortalAccessBanner from "@/components/superadmin/portal-access-banner";
import { getSessionUser } from "@/lib/auth";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "DRIVER") redirect("/");
  if (!user.driverId) redirect("/login");

  const navItems = [
    { href: "/driver", label: "Current Trip" },
    { href: "/driver/profile", label: "Profile" },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PortalAccessBanner />
      <header className="shrink-0 bg-sidebar text-white sticky top-0 z-10">
        <div className="h-1 w-full bg-accent" />
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <BrandLogo variant="dark" size="xl" />
          <div className="text-right min-w-0">
            <p className="font-heading font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-white/70">Driver</p>
          </div>
          <SignOutButton className="text-white/80 hover:text-white text-sm shrink-0" />
        </div>
        <PortalNav items={navItems} variant="dark" className="max-w-lg" />
      </header>
      <main className="flex-1 max-w-lg w-full mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
