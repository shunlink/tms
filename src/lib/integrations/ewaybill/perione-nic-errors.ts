import "server-only";

/** NIC / GSP e-Way Bill API error codes (authenticate and common failures). */
const NIC_EWAY_USER_MESSAGES: Record<string, string> = {
  "108":
    "E-Way Bill API rejected the username or password (NIC error 108). Use an API user created for the Perione GSP on the e-Way Bill portal—not your normal web login. Passwords should use letters and numbers only (special characters often fail). EWAY_USERNAME, EWAY_PASSWORD, EWAY_EMAIL, and EWAY_GSTIN must all be for the same GSTIN and environment (production vs staging).",
  "110":
    "Invalid Perione client ID or client secret (NIC error 110). Check EWAY_CLIENT_ID and EWAY_CLIENT_SECRET match the host in EWAY_API_BASE_URL.",
  "111":
    "This GSTIN is not registered with the Perione GSP (NIC error 111). Register the GSTIN for Perione on the e-Way Bill portal before calling the API.",
  "103":
    "Invalid client ID (NIC error 103). Verify EWAY_CLIENT_ID from Perione.",
  "104":
    "Invalid client secret (NIC error 104). Verify EWAY_CLIENT_SECRET from Perione.",
  "301":
    "Invalid e-way bill number (NIC error 301). Check all 12 digits.",
  "325":
    "Could not retrieve this e-way bill (NIC error 325). The bill may not exist, or your portal GSTIN is not a party on this bill (supplier, recipient, or transporter). Select the client whose GSTIN is on the bill before fetch, and confirm EWAY_USERNAME/EWAY_GSTIN match that account on the e-Way portal.",
};

type ErrorBody = {
  status_desc?: string;
  error?: string | { message?: string; error_cd?: string; errorCodes?: string | number };
};

export function extractNicEwayErrorCodes(body: ErrorBody): string[] {
  const codes: string[] = [];
  const err = body.error;
  if (err && typeof err === "object" && err.errorCodes != null && err.errorCodes !== "") {
    codes.push(String(err.errorCodes));
  }
  if (err && typeof err === "object" && err.message?.trim()) {
    try {
      const inner = JSON.parse(err.message) as { errorCodes?: string | number };
      if (inner.errorCodes != null && inner.errorCodes !== "") {
        codes.push(String(inner.errorCodes));
      }
    } catch {
      /* plain message */
    }
  }
  const desc = body.status_desc?.trim();
  if (desc) {
    try {
      const parsed = JSON.parse(desc) as { errorCodes?: string | number };
      if (parsed.errorCodes != null && parsed.errorCodes !== "") {
        codes.push(String(parsed.errorCodes));
      }
    } catch {
      /* plain text status_desc */
    }
  }
  const out: string[] = [];
  for (const c of codes) {
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

export function nicEwayErrorUserMessage(codes: string[], fallback: string): string {
  for (const code of codes) {
    const msg = NIC_EWAY_USER_MESSAGES[code];
    if (msg) return msg;
  }
  if (codes.length > 0) {
    return `${fallback} (NIC error ${codes.join(", ")}).`;
  }
  return fallback;
}
