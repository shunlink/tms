import { redirect } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import VendorOpenIndentsList from "@/components/portal/vendor-open-indents-list";
import { getSessionUser } from "@/lib/auth";
import { getVendorOpenIndents } from "@/lib/queries";
import { sanitizeNextPath } from "@/lib/vendor-quote-portal-url";
import PortalPage from "@/components/portal/portal-page";

export const dynamic = "force-dynamic";

export default async function VendorOpenIndentsPage({
  searchParams,
}: {
  searchParams?: { indentId?: string; from?: string };
}) {
  const user = await getSessionUser();
  const highlightIndentId = searchParams?.indentId?.trim() || null;
  const fromWhatsApp = searchParams?.from === "whatsapp";

  if (!user?.vendorId) {
    const next = sanitizeNextPath(
      highlightIndentId
        ? `/portal/vendor/indents?indentId=${encodeURIComponent(highlightIndentId)}`
        : "/portal/vendor/indents"
    );
    const login = `/login?portal=transporter${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    redirect(login);
  }

  const indents = await getVendorOpenIndents(user.vendorId);

  return (
    <PortalPage>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Open Indents
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Submit your best rate. One quote per indent — first valid submission wins.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200/60">
          <FileSpreadsheet className="h-4 w-4" />
          <span>{indents.length} Available</span>
        </div>
      </div>

      <VendorOpenIndentsList
        indents={indents}
        highlightIndentId={highlightIndentId}
        fromWhatsApp={fromWhatsApp}
      />
    </PortalPage>
  );
}
