// WhatsApp message builders — pure functions, no I/O, covered by unit tests.
//
// Keep messages short and plain — vendors should understand them without jargon.
// Reply syntax must stay in sync with parseQuoteMessage in ./whatsapp-parse.ts.

/** Label on the interactive WhatsApp button (max 20 chars for Meta). */
export const WHATSAPP_QUOTE_BUTTON_TITLE = "Submit my quote";

const IST = "Asia/Kolkata";

const clean = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

export function formatMessageDate(dt: Date | string | null | undefined): string | null {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST,
  }).format(d);
}

export function formatMessageDateTime(dt: Date | string | null | undefined): string | null {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  }).format(d);
  return `${formatMessageDate(d)}, ${time}`;
}

export function formatAmount(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

export function formatWeight(
  value: number | null | undefined,
  unit: string | null | undefined
): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return `${formatAmount(value)} ${clean(unit) ?? "MT"}`;
}

function place(city?: string | null, state?: string | null): string | null {
  const c = clean(city);
  const s = clean(state);
  if (c && s) return `${c}, ${s}`;
  return c ?? s;
}

function joinLabels(...parts: (string | null | undefined)[]): string | null {
  const kept = parts.map((p) => clean(p)).filter((p): p is string => p !== null);
  return kept.length ? kept.join(" · ") : null;
}

function buildLines(lines: (string | null)[]): string {
  return lines.filter((l): l is string => l !== null).join("\n");
}

export type IndentBidMessageInput = {
  indentNumber: string;
  clientName?: string | null;
  fromCity?: string | null;
  fromState?: string | null;
  toCity?: string | null;
  toState?: string | null;
  vehicleType?: string | null;
  bodyType?: string | null;
  quantity?: number | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  cargoType?: string | null;
  materialDescription?: string | null;
  pickupAt?: Date | string | null;
  deliveryAt?: Date | string | null;
  advanceAmount?: number | null;
  ewayBillRequired?: boolean | null;
  specialInstructions?: string | null;
};

export function buildIndentBidSubject(indentNumber: string): string {
  return `New indent: ${indentNumber}`;
}

export function buildIndentBidMessage(input: IndentBidMessageInput): string {
  const from = place(input.fromCity, input.fromState);
  const to = place(input.toCity, input.toState);
  const route = from && to ? `${from} to ${to}` : from ?? to;
  const advance = formatAmount(input.advanceAmount);
  const qty = input.quantity && input.quantity > 1 ? String(input.quantity) : null;
  const vehicle = joinLabels(input.vehicleType, input.bodyType);
  const cargo = joinLabels(input.cargoType, input.materialDescription);
  const client = clean(input.clientName);
  const pickup = formatMessageDate(input.pickupAt);
  const delivery = formatMessageDate(input.deliveryAt);
  const instructions = clean(input.specialInstructions);

  return buildLines([
    "NEW LOAD - OPEN FOR QUOTING",
    `Indent: ${input.indentNumber}`,
    client ? `Client: ${client}` : null,
    "",
    route ? `Route: ${route}` : null,
    vehicle ? `Vehicle: ${vehicle}` : null,
    qty ? `Vehicles needed: ${qty}` : null,
    formatWeight(input.weightValue, input.weightUnit)
      ? `Weight: ${formatWeight(input.weightValue, input.weightUnit)}`
      : null,
    cargo ? `Cargo: ${cargo}` : null,
    pickup ? `Pickup: ${pickup}` : null,
    delivery ? `Delivery by: ${delivery}` : null,
    advance ? `Advance paid: INR ${advance}` : null,
    input.ewayBillRequired ? "E-way bill: Required" : null,
    instructions ? `Note: ${instructions}` : null,
    "",
    "How to send your rate:",
    `1. Tap "${WHATSAPP_QUOTE_BUTTON_TITLE}" below`,
    "2. Reply with your amount in INR (example: 43000)",
    "",
    `Or reply: quote ${input.indentNumber} 43000`,
    "",
    "Send only one rate per indent. The first rate we receive is recorded.",
  ]);
}

export function buildQuoteAmountPromptMessage(indentNumber: string): string {
  return buildLines([
    `Indent ${indentNumber}`,
    "",
    "Please send your freight amount in INR.",
    "Example: 43000",
    "You can also send: 43000 or Rs 43000",
  ]);
}

export function buildQuoteAlreadySubmittedMessage(indentNumber: string): string {
  return buildLines([
    `Your quote for indent ${indentNumber} is already recorded.`,
    "",
    "Our team will contact you if your rate is accepted.",
  ]);
}

export function buildInvalidAmountMessage(): string {
  return buildLines([
    "That does not look like a valid amount.",
    "",
    "Please send only the number, for example: 43000",
  ]);
}

export function buildMultipleIndentsMessage(indentNumbers: string[]): string {
  const list = indentNumbers.map((n) => `- ${n}`).join("\n");
  return buildLines([
    "You have more than one open indent.",
    "",
    list,
    "",
    `Tap "${WHATSAPP_QUOTE_BUTTON_TITLE}" on the correct indent message, then send your amount.`,
    "",
    "Or reply: quote IND-2026-0001 43000",
  ]);
}

export function buildNoActiveIndentMessage(): string {
  return buildLines([
    `Tap "${WHATSAPP_QUOTE_BUTTON_TITLE}" on the indent message first, then send your amount.`,
    "",
    "Or reply: quote IND-2026-0001 43000",
  ]);
}

export function buildQuoteAckMessage(input: {
  vendorName?: string | null;
  indentNumber: string;
  quotedRate: number;
}): string {
  const name = clean(input.vendorName);
  return buildLines([
    "Quote received.",
    "",
    name ? `${name}, thank you.` : "Thank you.",
    `We recorded INR ${formatAmount(input.quotedRate)} for indent ${input.indentNumber}.`,
    "",
    "Our team will contact you if your rate is accepted.",
  ]);
}

export function buildVendorAllocatedMessage(input: {
  vendorName?: string | null;
  indentNumber: string;
  fromCity?: string | null;
  toCity?: string | null;
  vehicleType?: string | null;
  quotedRate?: number | null;
  advanceAmount?: number | null;
}): string {
  const name = clean(input.vendorName);
  const from = clean(input.fromCity);
  const to = clean(input.toCity);
  const vehicle = clean(input.vehicleType);
  const rate = formatAmount(input.quotedRate);
  const advance =
    input.advanceAmount != null ? formatAmount(input.advanceAmount) : null;
  return buildLines([
    "Indent allocated to you",
    "",
    `${name ? `${name}, indent` : "Indent"} ${input.indentNumber} has been allocated to you.`,
    from && to ? `Route: ${from} to ${to}` : null,
    vehicle ? `Vehicle: ${vehicle}` : null,
    rate ? `Quoted rate: INR ${rate}` : null,
    advance != null ? `Advance: INR ${advance}` : null,
    "",
    "Please log in to the vendor portal for next steps.",
  ]);
}

export function buildDriverOtpMessage(otp: string): string {
  return `Your ShunLink driver verification code is ${otp}. Valid for 10 minutes.`;
}
