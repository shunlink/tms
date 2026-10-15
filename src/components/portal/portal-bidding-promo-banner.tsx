import Link from "next/link";
import { Gavel, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

function getBiddingPortalUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BIDDING_SERVICE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export default function PortalBiddingPromoBanner({
  accent,
}: {
  accent: "client" | "vendor";
}) {
  const href = getBiddingPortalUrl();
  if (!href) return null;

  const styles =
    accent === "client"
      ? "border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 text-teal-950"
      : "border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 text-amber-950";

  const buttonStyles =
    accent === "client"
      ? "bg-teal-700 text-white hover:bg-teal-800 shadow-sm"
      : "bg-amber-700 text-white hover:bg-amber-800 shadow-sm";

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        styles
      )}
      role="region"
      aria-label="Bidding platform promotion"
    >
      <div className="flex gap-3 min-w-0">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            accent === "client" ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-900"
          )}
        >
          <Gavel className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-base leading-snug">New: Live Bidding &amp; Auctions</p>
          <p className="text-sm opacity-90 mt-0.5">
            Use the same TMS email and password to quote on loads and join auctions in real time.
          </p>
        </div>
      </div>
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
          buttonStyles
        )}
      >
        Access Live Bidding &amp; Auctions
        <ExternalLink className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
