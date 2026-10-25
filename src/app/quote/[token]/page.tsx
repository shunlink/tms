import { notFound } from "next/navigation";
import VendorPublicQuotePanel from "@/components/portal/vendor-public-quote-panel";
import { getPublicVendorQuoteView } from "@/lib/services/vendor-quote-access.service";

export const dynamic = "force-dynamic";

export default async function VendorPublicQuotePage({
  params,
}: {
  params: { token: string };
}) {
  const rawToken = decodeURIComponent(params.token.trim());
  const view = await getPublicVendorQuoteView(rawToken);

  if (!view.ok) {
    if (view.reason === "expired") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-bold text-gray-950">Link expired</h1>
            <p className="text-sm text-gray-600 mt-2">
              This quote link has expired. Open the latest indent message on WhatsApp or contact
              ShunLink operations.
            </p>
          </div>
        </div>
      );
    }
    notFound();
  }

  return (
    <VendorPublicQuotePanel
      accessToken={rawToken}
      vendorName={view.vendorName}
      indent={view.indent}
      canSubmit={view.canSubmit}
      existingQuote={view.existingQuote}
      closedReason={view.closedReason}
    />
  );
}
