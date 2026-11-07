/** Indent ops paperwork checklist — upload as DocumentAttachment entityType=INDENT. */

export type IndentDocumentTypeConfig = {
  type: string;
  label: string;
  /** Static required flag; EWAY_BILL is overridden by ewayBillRequired option. */
  required: boolean;
};

export const INDENT_DOCUMENT_TYPES: IndentDocumentTypeConfig[] = [
  { type: "MANUAL_LR", label: "Manual LR", required: false },
  { type: "EWAY_BILL", label: "Eway Bill", required: false },
  { type: "CLIENT_INVOICE", label: "Customer Invoice", required: true },
  { type: "VEHICLE_PHOTO", label: "Vehicle Photo", required: false },
  { type: "DRIVER_LICENSE", label: "Driver License", required: true },
  { type: "PO_APPROVAL", label: "PO/Approval", required: true },
  { type: "RC", label: "RC", required: true },
  { type: "LORRY_HIRE_RECEIPT", label: "Lorry Hire Receipt", required: true },
  { type: "DEBIT_NOTE", label: "Debit Note", required: false },
  { type: "DELIVERY_NOTE", label: "Delivery Note", required: false },
  { type: "OTHER", label: "Others", required: false },
];

export type IndentDocumentRequirementOptions = {
  ewayBillRequired?: boolean;
};

/** Effective checklist with E-way required only when the indent checkbox is on. */
export function resolveIndentDocumentTypes(
  options?: IndentDocumentRequirementOptions
): IndentDocumentTypeConfig[] {
  const ewayRequired = Boolean(options?.ewayBillRequired);
  return INDENT_DOCUMENT_TYPES.map((d) =>
    d.type === "EWAY_BILL" ? { ...d, required: ewayRequired } : d
  );
}

export function indentRequiredDocumentTypes(
  options?: IndentDocumentRequirementOptions
): string[] {
  return resolveIndentDocumentTypes(options)
    .filter((d) => d.required)
    .map((d) => d.type);
}

/** @deprecated Prefer indentRequiredDocumentTypes({ ewayBillRequired }) */
export const INDENT_REQUIRED_DOCUMENT_TYPES = indentRequiredDocumentTypes();

export type IndentDocumentProgress = {
  requiredTotal: number;
  requiredUploaded: number;
  optionalTotal: number;
  optionalUploaded: number;
  missingRequired: string[];
};

export function indentDocumentProgress(
  documents: { type: string }[],
  options?: IndentDocumentRequirementOptions
): IndentDocumentProgress {
  const configs = resolveIndentDocumentTypes(options);
  const uploaded = new Set(documents.map((d) => d.type));
  const required = configs.filter((d) => d.required);
  const optional = configs.filter((d) => !d.required);
  const missingRequired = required.filter((t) => !uploaded.has(t.type)).map((t) => t.label);
  return {
    requiredTotal: required.length,
    requiredUploaded: required.filter((t) => uploaded.has(t.type)).length,
    optionalTotal: optional.length,
    optionalUploaded: optional.filter((t) => uploaded.has(t.type)).length,
    missingRequired,
  };
}

export function indentDocumentLabel(type: string): string {
  return INDENT_DOCUMENT_TYPES.find((d) => d.type === type)?.label ?? type.replace(/_/g, " ");
}

/** Returns human-readable missing required doc labels (empty if complete). */
export function missingRequiredIndentDocumentLabels(
  documents: { type: string }[],
  options?: IndentDocumentRequirementOptions
): string[] {
  return indentDocumentProgress(documents, options).missingRequired;
}

export function formatMissingIndentDocumentsMessage(missingLabels: string[]): string {
  if (missingLabels.length === 0) return "";
  const listed =
    missingLabels.length <= 3
      ? missingLabels.join(", ")
      : `${missingLabels.slice(0, 3).join(", ")} +${missingLabels.length - 3} more`;
  return `Upload required documents before creating the trip / generating LR: ${listed}`;
}
