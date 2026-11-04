function envValue(name: string): string {
  const raw = process.env[name]?.trim() ?? "";
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

export function juspayApiKey(): string {
  const key = envValue("JUSPAY_API_KEY");
  if (!key) throw new Error("JUSPAY_API_KEY is not configured");
  return key;
}

export function juspayMerchantId(): string {
  const id = envValue("JUSPAY_MERCHANT_ID");
  if (!id) throw new Error("JUSPAY_MERCHANT_ID is not configured");
  return id;
}

export function juspayPaymentPageClientId(): string {
  const id = envValue("JUSPAY_PAYMENT_PAGE_CLIENT_ID");
  if (!id) throw new Error("JUSPAY_PAYMENT_PAGE_CLIENT_ID is not configured");
  return id;
}

export function juspayApiBase(): string {
  return (process.env.JUSPAY_API_BASE?.trim() || "https://sandbox.juspay.in").replace(/\/$/, "");
}

export function juspayConfigured(): boolean {
  return Boolean(
    process.env.JUSPAY_API_KEY?.trim() &&
      process.env.JUSPAY_MERCHANT_ID?.trim()
  );
}

/** Optional cap while Juspay merchant is in Restricted Mode (production often ₹9,000 max). */
export function juspayMaxCheckoutRupees(): number | null {
  const v = envValue("JUSPAY_MAX_CHECKOUT_RUPEES");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function juspayHypercheckoutWebhookCredentials(): { username: string; password: string } | null {
  const username = process.env.JUSPAY_WEBHOOK_USERNAME?.trim();
  const password = process.env.JUSPAY_WEBHOOK_PASSWORD ?? "";
  if (!username) return null;
  return { username, password };
}

export function juspayPayoutWebhookCredentials(): { username: string; password: string } | null {
  const username =
    process.env.JUSPAY_PAYOUT_WEBHOOK_USERNAME?.trim() ||
    process.env.JUSPAY_WEBHOOK_USERNAME?.trim();
  const password =
    process.env.JUSPAY_PAYOUT_WEBHOOK_PASSWORD ??
    process.env.JUSPAY_WEBHOOK_PASSWORD ??
    "";
  if (!username) return null;
  return { username, password };
}

export function appPublicBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (!base) return "http://localhost:3000";
  return base.replace(/\/$/, "");
}
