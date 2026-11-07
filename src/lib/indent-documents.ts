/** Indent ops paperwork checklist — upload as DocumentAttachment entityType=INDENT. */

export type IndentDocumentTypeConfig = {
  type: string;
  label: string;
  required: boolean;
};

export const INDENT_DOCUMENT_TYPES: IndentDocumentTypeConfig[] = [
  { type: "MANUAL_LR", label: "Manual LR", required: true },
  { type: "EWAY_BILL", label: "Eway Bill", required: true },
  { type: "CLIENT_INVOICE", label: "Customer Invoice", required: true },
  { type: "VEHICLE_PHOTO", label: "Vehicle Photo", required: true },
  { type: "DRIVER_LICENSE", label: "Driver License", required: true },
  { type: "PO_APPROVAL", label: "PO/Approval", required: true },
  { type: "RC", label: "RC", required: true },
  { type: "LORRY_HIRE_RECEIPT", label: "Lorry Hire Receipt", required: true },
  { type: "DEBIT_NOTE", label: "Debit Note", required: false },
  { type: "DELIVERY_NOTE", label: "Delivery Note", required: false },
  { type: "OTHER", label: "Others", required: false },
];

export const INDENT_REQUIRED_DOCUMENT_TYPES = INDENT_DOCUMENT_TYPES.filter((d) => d.required).map(
  (d) => d.type
);

export type IndentDocumentProgress = {
  requiredTotal: number;
  requiredUploaded: number;
  optionalTotal: number;
  optionalUploaded: number;
  missingRequired: string[];
};

export function indentDocumentProgress(
  documents: { type: string }[]
): IndentDocumentProgress {
  const uploaded = new Set(documents.map((d) => d.type));
  const required = INDENT_DOCUMENT_TYPES.filter((d) => d.required);
  const optional = INDENT_DOCUMENT_TYPES.filter((d) => !d.required);
  const missingRequired = required.filter((d) => !uploaded.has(d.type)).map((d) => d.label);
  return {
    requiredTotal: required.length,
    requiredUploaded: required.filter((d) => uploaded.has(d.type)).length,
    optionalTotal: optional.length,
    optionalUploaded: optional.filter((d) => uploaded.has(d.type)).length,
    missingRequired,
  };
}

export function indentDocumentLabel(type: string): string {
  return INDENT_DOCUMENT_TYPES.find((d) => d.type === type)?.label ?? type.replace(/_/g, " ");
}

/** Returns human-readable missing required doc labels (empty if complete). */
export function missingRequiredIndentDocumentLabels(documents: { type: string }[]): string[] {
  return indentDocumentProgress(documents).missingRequired;
}

export function formatMissingIndentDocumentsMessage(missingLabels: string[]): string {
  if (missingLabels.length === 0) return "";
  const listed =
    missingLabels.length <= 3
      ? missingLabels.join(", ")
      : `${missingLabels.slice(0, 3).join(", ")} +${missingLabels.length - 3} more`;
  return `Upload required documents before creating the trip / generating LR: ${listed}`;
}
