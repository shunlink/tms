import QRCode from "qrcode";

/** Public app origin for links embedded in printed documents. */
export function getPublicAppBaseUrlOrFallback(): string {
  return (process.env.PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}

/** Dashboard invoice detail (preview + download). */
export function buildInvoiceDetailPageUrl(invoiceId: string): string {
  return `${getPublicAppBaseUrlOrFallback()}/invoices/${encodeURIComponent(invoiceId)}`;
}

/** Opens the stored LR PDF (same flow as View / Download on the trip page). */
export function buildTripLrOpenUrl(tripId: string): string {
  return `${getPublicAppBaseUrlOrFallback()}/trips/${encodeURIComponent(tripId)}/lr`;
}

export async function qrCodePngDataUrl(url: string, px = 96): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: px,
  });
}

/** Inline SVG renders reliably in Puppeteer PDF output (preferred for invoices). */
export async function qrCodeInlineSvg(url: string, px = 56): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    width: px,
  });
  return svg.replace(/^<svg /, `<svg class="doc-qr-svg" width="${px}" height="${px}" `);
}
