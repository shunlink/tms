/** React Native multipart often yields Blob, not File — normalize before upload. */
export async function readMultipartFile(
  part: FormDataEntryValue | null,
  fallbackName: string
): Promise<File | null> {
  if (part == null) return null;
  if (part instanceof File && part.size > 0) return part;
  if (typeof Blob !== "undefined" && part instanceof Blob) {
    const buffer = Buffer.from(await part.arrayBuffer());
    if (buffer.length === 0) return null;
    const name = part instanceof File && part.name ? part.name : fallbackName;
    return new File([buffer], name, { type: part.type || "image/jpeg" });
  }
  return null;
}
