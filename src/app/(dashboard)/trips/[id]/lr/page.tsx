import { notFound, redirect } from "next/navigation";
import { getTripLrDocument } from "@/lib/services/lr-document.service";

export const dynamic = "force-dynamic";

/** Deep link from LR QR — redirects to the generated PDF file. */
export default async function TripLrPdfOpenPage({ params }: { params: { id: string } }) {
  const doc = await getTripLrDocument(params.id);
  if (!doc.ok || !doc.url) notFound();
  redirect(doc.url);
}
