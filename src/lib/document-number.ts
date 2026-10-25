/** Prefix templates from Settings (e.g. INV-{YYYY}-, LR-2026-). */

export type ConfigurableNumberKind = "INV" | "LR" | "REQ";

export function defaultNumberPrefixTemplate(kind: ConfigurableNumberKind, year = new Date().getFullYear()): string {
  switch (kind) {
    case "INV":
      return `INV-${year}-`;
    case "LR":
      return `LR-${year}-`;
    case "REQ":
      return `REQ-${year}-`;
  }
}

export function applyYearTokens(template: string, year = new Date().getFullYear()): string {
  return template.replace(/\{YYYY\}/gi, String(year)).replace(/\{YY\}/gi, String(year).slice(-2));
}

/** Build display number: template + zero-padded sequence (e.g. INV-2026-0007). */
export function formatDocumentNumber(prefixTemplate: string, sequence: number, pad = 4): string {
  const seq = String(sequence).padStart(pad, "0");
  const t = prefixTemplate.trim();
  if (!t) return seq;
  if (t.endsWith("-") || t.endsWith("/") || t.endsWith("_")) {
    return `${t}${seq}`;
  }
  return `${t}-${seq}`;
}

export function exampleDocumentNumber(prefixTemplate: string, sequence = 1): string {
  return formatDocumentNumber(applyYearTokens(prefixTemplate), sequence);
}

export function isConfigurableNumberKind(prefix: string): prefix is ConfigurableNumberKind {
  return prefix === "INV" || prefix === "LR" || prefix === "REQ";
}
