import { cn } from "@/lib/utils";

export function formatProfileValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function formatInr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ProfileField({
  label,
  value,
  className,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  className?: string;
  mono?: boolean;
}) {
  const display = formatProfileValue(value);
  const empty = display === "—";
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1.5 text-sm leading-snug break-words",
          empty ? "text-muted-foreground" : "font-medium text-foreground",
          mono && !empty && "font-mono text-[13px]"
        )}
      >
        {display}
      </dd>
    </div>
  );
}

export function ProfileFieldGrid({ children, columns = 2 }: { children: React.ReactNode; columns?: 1 | 2 | 3 }) {
  return (
    <dl
      className={cn(
        "grid gap-x-8 gap-y-5",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {children}
    </dl>
  );
}

export function GstVerificationBadge({
  status,
  verifiedAt,
}: {
  status?: string | null;
  verifiedAt?: Date | string | null;
}) {
  if (!status || status === "UNVERIFIED" || status === "NOT_STARTED") return null;
  const verified = status === "VERIFIED";
  const date =
    verifiedAt instanceof Date
      ? verifiedAt.toLocaleDateString("en-IN")
      : verifiedAt
        ? new Date(verifiedAt).toLocaleDateString("en-IN")
        : null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      )}
    >
      GST {verified ? "verified" : status.replace(/_/g, " ").toLowerCase()}
      {verified && date ? ` · ${date}` : ""}
    </span>
  );
}
