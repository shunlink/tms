import Link from "next/link";
import { ExternalLink, Gavel, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const COPY = {
  client: {
    badge: "New",
    headline: "One-time trip? Try Live Bidding",
    subcopy:
      "Post a spot load, compare curated carrier rates, and award in minutes — sign in with your same TMS email and password.",
    cta: "Explore spot bidding",
    loginAs: "client",
  },
  vendor: {
    badge: "New",
    headline: "Spot loads & one-time trips",
    subcopy:
      "Quote on ad-hoc lanes and live auctions when you have empty capacity — use your existing TMS login.",
    cta: "Quote on spot loads",
    loginAs: "vendor",
  },
} as const;

/** Public URL for the bidding app (browser). Prefer NEXT_PUBLIC_*; fall back to BIDDING_SERVICE_URL + `/bidding`. */
function resolveBiddingPublicBaseUrl(): string | null {
  const fromPublic = process.env.NEXT_PUBLIC_BIDDING_SERVICE_URL?.trim();
  if (fromPublic) {
    return fromPublic.replace(/\/$/, "");
  }

  const fromServer = process.env.BIDDING_SERVICE_URL?.trim();
  if (!fromServer) {
    return null;
  }

  const base = fromServer.replace(/\/$/, "");
  if (/\/bidding$/i.test(base)) {
    return base;
  }
  return `${base}/bidding`;
}

function getBiddingPortalLoginUrl(accent: "client" | "vendor"): string | null {
  const base = resolveBiddingPublicBaseUrl();
  if (!base) return null;
  return `${base}/login?as=${COPY[accent].loginAs}`;
}

export default function PortalBiddingPromoBanner({
  accent,
}: {
  accent: "client" | "vendor";
}) {
  const href = getBiddingPortalLoginUrl(accent);
  if (!href) return null;

  const copy = COPY[accent];

  const styles =
    accent === "client"
      ? "border-teal-200/90 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 text-teal-950 shadow-sm"
      : "border-[#F5D33C]/50 bg-gradient-to-r from-amber-50/80 via-yellow-50/60 to-amber-50/80 text-gray-950 shadow-sm";

  const buttonStyles =
    accent === "client"
      ? "bg-teal-700 text-white hover:bg-teal-800 shadow-sm"
      : "bg-[#F5D33C] text-gray-950 hover:bg-[#EAC72E] font-bold shadow-xs";

  return (
    <div
      className={cn(
        "relative mb-6 flex flex-col gap-4 overflow-hidden rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        styles,
      )}
      role="region"
      aria-label="Bidding platform promotion"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/30 blur-2xl"
        aria-hidden
      />
      <div className="flex gap-3 min-w-0">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            accent === "client" ? "bg-teal-100 text-teal-800" : "bg-[#F5D33C]/25 text-gray-950",
          )}
        >
          <Gavel className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-base leading-snug">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-800 ring-1 ring-black/5">
              <Sparkles className="h-3 w-3" aria-hidden />
              {copy.badge}
            </span>
            {copy.headline}
          </p>
          <p className="text-sm opacity-90 mt-1 max-w-xl">{copy.subcopy}</p>
        </div>
      </div>
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors",
          buttonStyles,
        )}
      >
        {copy.cta}
        <ExternalLink className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
