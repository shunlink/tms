// Pure WhatsApp quote message parser — feeds the SAME VendorQuote system.

export type ParsedQuote = { indentNumber: string; quotedRate: number };

/** Button payload id prefix for Meta interactive replies. */
export const QUOTE_BUTTON_PREFIX = "quote:";

export function buildQuoteButtonId(indentId: string) {
  return `${QUOTE_BUTTON_PREFIX}${indentId}`;
}

export function parseQuoteButtonId(buttonId: string): string | null {
  if (!buttonId.startsWith(QUOTE_BUTTON_PREFIX)) return null;
  const indentId = buttonId.slice(QUOTE_BUTTON_PREFIX.length).trim();
  return indentId || null;
}

/**
 * Parses a bare numeric amount from a WhatsApp reply, e.g. "45000", "₹45,000".
 * Returns null for invalid input.
 */
export function parseQuoteAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Reject messages that still carry an indent token — those belong to parseQuoteMessage.
  if (/IND-\d{4}-\d{4}/i.test(trimmed)) return null;

  const match = trimmed.match(/^(?:₹|rs\.?\s*|inr\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*$/i);
  if (!match) return null;

  const quotedRate = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(quotedRate) || quotedRate <= 0) return null;
  return quotedRate;
}

/**
 * Parses a vendor quote reply. Accepts e.g.
 *   "quote IND-2026-0001 42000"
 *   "42000 for IND-2026-0001"
 *   "IND-2026-0001 ₹42,000"
 * Returns null for invalid/ambiguous input (rejected safely).
 */
export function parseQuoteMessage(text: string): ParsedQuote | null {
  const m = text.match(/IND-\d{4}-\d{4}/i);
  if (!m) return null;
  const indentNumber = m[0].toUpperCase();

  // Remove the indent token so the rate is unambiguous (otherwise the year/seq
  // inside the indent number would be mistaken for the rate).
  const remainder = text.replace(m[0], "");
  const rateMatch = remainder.match(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]{2,})/i);
  if (!rateMatch) return null;

  const quotedRate = Number(rateMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(quotedRate) || quotedRate <= 0) return null;

  return { indentNumber, quotedRate };
}
