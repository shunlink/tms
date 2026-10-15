"use client";

type DocStatus = "VALID" | "EXPIRED" | "UNKNOWN";

function badgeClass(status: DocStatus) {
  if (status === "VALID") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "EXPIRED") return "bg-red-100 text-red-800 border-red-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export function ComplianceBadges({
  rc,
  insurance,
  puc,
  fitness,
}: {
  rc?: DocStatus;
  insurance?: DocStatus;
  puc?: DocStatus;
  fitness?: DocStatus;
}) {
  const items = [
    ["RC", rc ?? "UNKNOWN"],
    ["Insurance", insurance ?? "UNKNOWN"],
    ["PUC", puc ?? "UNKNOWN"],
    ["Fitness", fitness ?? "UNKNOWN"],
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([label, status]) => (
        <span
          key={label}
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass(status)}`}
        >
          {label}: {status}
        </span>
      ))}
    </div>
  );
}
