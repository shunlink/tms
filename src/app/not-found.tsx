import Link from "next/link";
import { ArrowLeft, MapPinOff } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import { getSessionUser } from "@/lib/auth";
import { resolveAuthenticatedHomePath } from "@/lib/auth-redirect";

export default async function NotFound() {
  const user = await getSessionUser();
  const dashboardHref = user?.id ? await resolveAuthenticatedHomePath(user) : "/welcome";
  const dashboardLabel = user?.id ? "Go to dashboard" : "Back to home";

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col">
      <header className="px-6 py-8 sm:px-10">
        <BrandLogo variant="light" href={dashboardHref} size="md" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-gray-200 shadow-sm text-[#B45309]">
          <MapPinOff className="h-8 w-8" aria-hidden />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#B45309]">404</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-950">Page not found</h1>
        <p className="mt-3 max-w-md text-sm sm:text-base text-gray-600 leading-relaxed">
          The link may be outdated or you may not have access to this page. Head back to your workspace to
          continue.
        </p>

        <Link
          href={dashboardHref}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#F5D33C] px-6 py-3 text-sm font-bold text-slate-900 hover:bg-[#EAC72E] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {dashboardLabel}
        </Link>
      </main>
    </div>
  );
}
