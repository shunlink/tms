import { redirect } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PortalPageHeader from "@/components/portal/portal-page-header";
import PortalEmptyState from "@/components/portal/portal-empty-state";
import VendorQuoteForm from "@/components/forms/vendor-quote-form";
import { getSessionUser } from "@/lib/auth";
import { getVendorOpenIndents } from "@/lib/queries";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorOpenIndentsPage() {
  const user = await getSessionUser();
  if (!user?.vendorId) redirect("/login");

  const indents = await getVendorOpenIndents(user.vendorId);

  return (
    <div>
      <PortalPageHeader
        accent="vendor"
        title="Open indents"
        description="Submit your best rate. One quote per indent — first valid submission wins."
      />

      {indents.length === 0 ? (
        <PortalEmptyState
          icon={FileSpreadsheet}
          title="No open indents"
          description="New loads are published when clients release requirements. Check back soon."
        />
      ) : (
        <div className="space-y-5">
          {indents.map((indent) => (
            <Card key={indent.id} className="border-border/80 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{indent.indentNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{indent.client}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-warning/15 text-warning font-medium">
                      {indent.status.replace(/_/g, " ")}
                    </span>
                    {indent.advanceAmount != null && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">
                        Advance {formatINR(indent.advanceAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {indent.advanceAmount != null && (
                  <p className="text-sm text-success bg-success/5 border border-success/20 rounded-lg px-3 py-2.5 mb-4 leading-relaxed">
                    Advance for this load: {formatINR(indent.advanceAmount)}.
                    {indent.advanceAmount > 0
                      ? " Paid per agreement after you are allocated."
                      : " No advance on this load."}
                  </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-5">
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Route</p>
                    <p className="font-medium mt-1">{indent.route}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Vehicle</p>
                    <p className="font-medium mt-1">{indent.vehicleType.replace(/_/g, " ")}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Pickup</p>
                    <p className="font-medium mt-1">
                      {indent.pickupAt ? formatDate(indent.pickupAt) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Weight</p>
                    <p className="font-medium mt-1">
                      {indent.weightValue != null
                        ? `${indent.weightValue} ${indent.weightUnit}`
                        : "—"}
                    </p>
                  </div>
                </div>
                <VendorQuoteForm indentId={indent.id} existingQuote={indent.myQuote} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
