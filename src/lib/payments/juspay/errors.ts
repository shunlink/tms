/** Short user-facing text from Juspay / checkout failures (avoid dumping JSON in toasts). */
export function formatJuspayErrorForUser(err: unknown): string {
  if (!(err instanceof Error)) return "Could not start payment. Please try again.";

  const msg = err.message;
  const status = (err as Error & { status?: number }).status;
  const body = (err as Error & { body?: unknown }).body;

  if (status === 401) {
    return "Juspay rejected the API key. Check JUSPAY_API_KEY and JUSPAY_MERCHANT_ID match JUSPAY_API_BASE (sandbox vs production).";
  }
  if (status === 403) {
    return "Juspay blocked this server IP. Whitelist your public IP in portal.juspay.in, or test from an allowed server.";
  }

  if (typeof body === "object" && body && "error_info" in body) {
    const info = (body as {
      error_info?: {
        user_message?: string;
        developer_message?: string;
        code?: string;
        fields?: { field_name?: string; reason?: string }[];
      };
    }).error_info;
    if (info?.fields?.length) {
      const amountField = info.fields.find((f) => f.field_name === "amount");
      if (amountField?.reason) return amountField.reason;
      const first = info.fields[0]?.reason;
      if (first) return first;
    }
    if (info?.code === "RESOURCE_NOT_FOUND") {
      return "Previous checkout expired. Click Pay again.";
    }
    if (info?.user_message && info.user_message !== "Unauthenticated") {
      return info.user_message;
    }
    if (info?.developer_message) return info.developer_message;
  }

  if (msg.includes("HTTPS return URL")) return msg;
  if (msg.includes("did not return a payment link")) return msg;
  if (msg.includes("Online payments are not enabled")) return msg;
  if (msg.includes("outstanding") || msg.includes("Invoice")) return msg;
  if (msg.startsWith("Juspay ")) {
    const short = msg.replace(/^Juspay \w+ \S+ failed \(\d+\): /, "").slice(0, 200);
    return short || "Juspay checkout failed. Check dashboard credentials and return URL.";
  }

  return msg.length <= 200 ? msg : "Could not start payment. Check Juspay settings and try again.";
}
