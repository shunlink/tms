export type ExportColumn = { key: string; header: string };

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** UTF-8 BOM so Excel opens CSV with correct encoding. */
export function rowsToExcelCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key];
        const text = raw == null || raw === "" ? "" : String(raw);
        return escapeCsvCell(text);
      })
      .join(",")
  );
  return `\uFEFF${header}\n${lines.join("\n")}`;
}

export function downloadExcelCsv(fileName: string, columns: ExportColumn[], rows: Record<string, unknown>[]) {
  const csv = rowsToExcelCsv(columns, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
