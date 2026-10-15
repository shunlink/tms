import BrandLogo from "./brand-logo";
import PortalNav, { type PortalNavItem } from "./portal-nav";
import SignOutButton from "./sign-out-button";
import { PORTAL_THEME, portalUserInitial, type PortalAccent } from "@/lib/portal-theme";
import { cn } from "@/lib/utils";

export default function PortalShell({
  brand,
  subtitle,
  userName,
  navItems,
  accent = "vendor",
  children,
}: {
  brand: string;
  subtitle: string;
  userName: string;
  navItems: PortalNavItem[];
  accent?: PortalAccent;
  children: React.ReactNode;
}) {
  const theme = PORTAL_THEME[accent];
  const initial = portalUserInitial(userName || subtitle);

  return (
    <div className={cn("flex min-h-dvh flex-col bg-background", theme.pageBg)}>
      <header className="sticky top-0 z-40 shrink-0 bg-sidebar text-white shadow-md shadow-sidebar/20 print:static print:shadow-none">
        <div className={cn("h-1 w-full bg-gradient-to-r", theme.headerGlow, accent === "client" ? "from-teal-400" : "from-accent")} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <BrandLogo variant="dark" size="lg" href="/" />
            <div className="min-w-0 border-l border-white/15 pl-3 sm:pl-4">
              <h1 className="font-heading font-bold text-white leading-tight text-sm sm:text-base truncate">
                {brand}
              </h1>
              <p className="text-xs text-white/65 truncate max-w-[10rem] sm:max-w-none">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              className="hidden sm:flex items-center gap-2.5 rounded-full bg-white/10 pl-1 pr-3 py-1 border border-white/10"
              title={userName}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                  accent === "client" ? "bg-teal-500 text-white" : "bg-accent text-accent-foreground"
                )}
                aria-hidden
              >
                {initial}
              </span>
              <span className="text-sm text-white/90 font-medium max-w-[12rem] truncate">{userName}</span>
            </div>
            <SignOutButton className="text-white/80 hover:text-white text-sm font-medium px-2 sm:px-0" />
          </div>
        </div>
        <PortalNav items={navItems} variant="dark" accent={accent} />
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 print:p-0">
        {children}
      </main>
      <footer className="print:hidden py-6 text-center text-xs text-muted-foreground">
        ShunLink TMS · {brand}
      </footer>
    </div>
  );
}
