"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function InvoicePdfDownload({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  return (
    <a href={`/api/invoices/${invoiceId}/pdf`} download={`${invoiceNumber}.pdf`}>
      <Button type="button" size="sm" variant="outline" className="gap-2">
        <Download className="h-4 w-4" /> Download PDF
      </Button>
    </a>
  );
}
