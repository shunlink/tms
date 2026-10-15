import { readFile } from "fs/promises";
import path from "path";
import { requireAuth, unauthorized, notFound } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Serves uploaded documents to any authenticated user.
// Runtime uploads are not reliably served from /public by `next start`, so we
// stream them here (and keep them behind auth).
export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } }
) {
  if (!(await requireAuth())) return unauthorized();
  try {
    const base = path.join(process.cwd(), "public", "uploads");
    const rel = (params.path ?? []).join("/");
    const full = path.normalize(path.join(base, rel));
    if (!full.startsWith(base)) return notFound("File not found");

    const bytes = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    return new Response(bytes, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return notFound("File not found");
  }
}
