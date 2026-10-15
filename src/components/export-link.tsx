import { Download } from "lucide-react";

export default function ExportLink({
  entity,
  label = "Export CSV",
}: {
  entity: string;
  label?: string;
}) {
  return (
    <a
      href={`/api/export/${entity}`}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 h-10 text-sm hover:bg-slate-50"
    >
      <Download className="h-4 w-4" /> {label}
    </a>
  );
}
