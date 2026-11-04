import { createHash, randomBytes } from "crypto";

const JUSPAY_ORDER_ID_MAX = 20;
const ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Juspay requires alphanumeric order ids with length strictly less than 21. */
export function generateJuspayOrderId(prefix = "T"): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3) || "T";
  const ts = Date.now().toString(36).replace(/[^a-z0-9]/gi, "");
  const rand = randomBytes(4).toString("hex").slice(0, 8);
  let id = `${safePrefix}${ts}${rand}`.replace(/[^a-zA-Z0-9]/g, "");
  if (id.length > JUSPAY_ORDER_ID_MAX) {
    id = id.slice(0, JUSPAY_ORDER_ID_MAX);
  }
  if (id.length < 8) {
    id = (id + createHash("sha256").update(rand).digest("hex")).slice(0, JUSPAY_ORDER_ID_MAX);
  }
  return id;
}

export function isValidJuspayOrderId(id: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(id) && id.length > 0 && id.length < 21;
}

/** Stable bene id for Juspay (max practical length). */
export function beneficiaryRefFromInternalId(beneficiaryId: string): string {
  const hash = createHash("sha256").update(beneficiaryId).digest("hex").slice(0, 16);
  return `B${hash}`;
}
