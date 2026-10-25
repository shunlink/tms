import Link from "next/link";
import { cn } from "@/lib/utils";

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export type ShunlinkIndentButtonProps = {
  indentCount: number;
  href?: string;
  className?: string;
};

export default function ShunlinkIndentButton({
  indentCount,
  href = "/portal/vendor/indents",
  className,
}: ShunlinkIndentButtonProps) {
  const active = indentCount > 0;
  const countLabel = indentCount > 99 ? "99+" : String(indentCount);
  const urgentLabel =
    indentCount === 1
      ? "Quote on 1 New Indent!"
      : `Quote on ${indentCount} New Indents!`;

  return (
    <Link
      href={href}
      className={cn(
        "relative z-10 inline-flex w-full sm:w-auto items-center justify-center gap-2.5 px-5 py-3 min-h-[44px] rounded-full text-xs sm:text-sm",
        "transition-[transform,box-shadow,background-color] duration-200 active:scale-[0.97]",
        active
          ? cn(
              "bg-[#F5D33C] text-gray-950 font-bold border border-[#E5C42E]",
              "shunlink-indent-btn-urgent-pop",
              "hover:bg-[#EBCA38] hover:scale-[1.02]"
            )
          : cn(
              "bg-white text-gray-500 font-semibold border border-gray-200",
              "shadow-none hover:bg-white hover:text-gray-500"
            ),
        className
      )}
      aria-label={active ? urgentLabel : "No open indents"}
    >
      <DocumentIcon className={cn(active ? "text-gray-950" : "text-gray-400")} />
      <span>{active ? urgentLabel : "No Open Indents"}</span>
      {active && (
        <span
          className={cn(
            "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-gray-950 px-1.5",
            "text-[10px] font-bold text-[#F5D33C] tabular-nums shunlink-indent-badge-pulse"
          )}
          aria-hidden
        >
          {countLabel}
        </span>
      )}
    </Link>
  );
}
