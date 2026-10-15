/** Server-side document upload validation. */

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return "";
  return fileName.slice(dot).toLowerCase();
}

export type DocumentValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateUploadedFile(file: {
  name: string;
  size: number;
  type?: string;
}): DocumentValidationResult {
  if (file.size === 0) {
    return { ok: false, message: "File is empty." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: "File size exceeds the allowed limit (10 MB)." };
  }

  const ext = extensionOf(file.name);
  if (!ext || !ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      message: "File type is not supported. Allowed: PDF, JPG, PNG, WEBP.",
    };
  }

  const mime = (file.type ?? "").toLowerCase();
  if (mime && mime !== "application/octet-stream" && !ALLOWED_DOCUMENT_MIMES.has(mime)) {
    return {
      ok: false,
      message: "File type is not supported. Allowed: PDF, JPG, PNG, WEBP.",
    };
  }

  return { ok: true };
}
