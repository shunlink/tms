/** `YYYY-MM-DD` in the user's local timezone (for `<input type="date">`). */
export function localDateInputValue(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lexicographic compare is valid for ISO date strings. */
export function isDateInputBeforeToday(dateStr: string): boolean {
  const s = dateStr.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return s < localDateInputValue();
}

/**
 * @deprecated Past dates are allowed on indent forms; kept for callers that still import it.
 * Returns no minimum so `<input type="date">` is unrestricted.
 */
export function dateInputMinForField(
  _currentValue?: string,
  _mode?: "create" | "edit"
): string | undefined {
  return undefined;
}

export const INDENT_OPERATIONAL_DATE_FIELDS = [
  "indentDate",
  "pickupDate",
  "deliveryDate",
  "podDueAt",
] as const;

/** Past operational dates are allowed — always returns no field errors. */
export function indentOperationalDateFieldErrors(
  _fields?: Record<string, string | null | undefined | unknown>
): Record<string, string> {
  return {};
}
