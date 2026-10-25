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
 * Minimum selectable date: today on create; on edit, keep an existing past value but do not allow an earlier day.
 */
export function dateInputMinForField(
  currentValue: string,
  mode: "create" | "edit"
): string {
  const today = localDateInputValue();
  if (mode === "create") return today;
  if (currentValue && currentValue < today) return currentValue;
  return today;
}

export const INDENT_OPERATIONAL_DATE_FIELDS = [
  "indentDate",
  "pickupDate",
  "deliveryDate",
  "podDueAt",
] as const;

const INDENT_DATE_LABELS: Record<(typeof INDENT_OPERATIONAL_DATE_FIELDS)[number], string> = {
  indentDate: "Indent date",
  pickupDate: "Pickup date",
  deliveryDate: "Expected delivery date",
  podDueAt: "POD due date",
};

export function indentOperationalDateFieldErrors(
  fields: Record<string, string | null | undefined | unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of INDENT_OPERATIONAL_DATE_FIELDS) {
    const raw = fields[key];
    if (raw == null || raw === "") continue;
    const v = String(raw).slice(0, 10);
    if (isDateInputBeforeToday(v)) {
      errors[key] = `${INDENT_DATE_LABELS[key]} cannot be in the past`;
    }
  }
  return errors;
}
