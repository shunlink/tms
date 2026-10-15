import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export function storageDriver() {
  return process.env.STORAGE_DRIVER ?? "local";
}

// Pluggable object storage. Local by default; S3 when STORAGE_DRIVER=s3 and the
// AWS SDK is installed and configured.
export async function putObject(key: string, bytes: Buffer): Promise<{ url: string }> {
  const driver = storageDriver();

  if (driver === "s3") {
    throw new Error(
      "S3 storage driver requires @aws-sdk/client-s3 plus S3_BUCKET/AWS_REGION configuration."
    );
  }

  const fullPath = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
  return { url: `/files/${key}` };
}

export async function removeObject(url: string): Promise<void> {
  if (url.startsWith("http")) return; // remote object; handled by provider
  try {
    const rel = url.replace(/^\/(files|uploads)\//, "");
    const fullPath = path.join(process.cwd(), "public", "uploads", rel);
    await unlink(fullPath);
  } catch {
    // already gone; ignore
  }
}
