export function parseIsoDate(value: string | null | undefined, field: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}`);
  return d;
}

export function parseReportDates(url: URL) {
  const asOf = parseIsoDate(url.searchParams.get("asOfDate"), "asOfDate");
  const fromDate = parseIsoDate(url.searchParams.get("fromDate"), "fromDate");
  const toDate = parseIsoDate(url.searchParams.get("toDate"), "toDate");
  const currency = url.searchParams.get("currency") ?? "INR";
  return { asOf, fromDate, toDate, currency };
}
