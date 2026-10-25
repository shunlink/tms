"use client";

import { Download } from "lucide-react";
import { downloadExcelCsv, type ExportColumn } from "@/lib/table-export";

export default function PortalTableExport({
  fileName,
  columns,
  rows,
  label = "Export Excel",
}: {
  fileName: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  label?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => downloadExcelCsv(fileName, columns, rows)}
      className="inline-flex items-center gap-2 min-h-[36px] px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
