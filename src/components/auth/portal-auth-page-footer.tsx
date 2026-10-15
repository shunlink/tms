import Link from "next/link";

export default function PortalAuthPageFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto pt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs text-slate-500">
      <p>© {year} ShunLink. All rights reserved.</p>
      <div className="flex items-center gap-3">
        <Link href="/welcome" className="hover:text-slate-700 transition-colors">
          Privacy Policy
        </Link>
        <span className="text-slate-300">|</span>
        <Link href="/welcome" className="hover:text-slate-700 transition-colors">
          Terms of Use
        </Link>
      </div>
    </footer>
  );
}
