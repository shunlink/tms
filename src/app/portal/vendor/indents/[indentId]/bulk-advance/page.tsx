import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PortalPage from "@/components/portal/portal-page";
import VendorBulkAdvancePanel from "@/components/portal/vendor-bulk-advance-panel";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function VendorBulkAdvancePage({ params }: { params: { indentId: string } }) {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login?portal=transporter");

  const indent = await prisma.indent.findFirst({
    where: { id: params.indentId, vendorId: user.vendorId },
    select: { id: true, indentNumber: true },
  });
  if (!indent) notFound();

  return (
    <PortalPage>
      <div className="mb-6">
        <Link
          href="/portal/vendor/trips"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to trips
        </Link>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
          Bulk advance — {indent.indentNumber}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-xl">
          Request ShunLink advance for multiple LRs on this indent in one step. Finance still reviews each
          request separately.
        </p>
      </div>
      <VendorBulkAdvancePanel indentId={indent.id} indentNumber={indent.indentNumber} />
    </PortalPage>
  );
}
