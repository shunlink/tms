export const CLIENT_INVOICE_LINE_KINDS = ["FREIGHT", "LOADING", "UNLOADING"] as const;
export type ClientInvoiceLineKind = (typeof CLIENT_INVOICE_LINE_KINDS)[number];
