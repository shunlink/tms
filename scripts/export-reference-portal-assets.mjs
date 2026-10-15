/**
 * Converts reference-generated JPGs (no SVG overlay) to public WebP paths.
 * Run: node scripts/export-reference-portal-assets.mjs
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.resolve(
  ROOT,
  "..",
  "..",
  ".cursor",
  "projects",
  "c-Users-vikra-Code-TMS",
  "assets"
);

const exports = [
  ["ref-portal-dashboard-hero-client.jpg", "public/portal/portal-dashboard-hero-client.webp"],
  ["ref-portal-dashboard-hero-vendor.jpg", "public/portal/portal-dashboard-hero-vendor.webp"],
  ["ref-portal-dashboard-sidebar-client.jpg", "public/portal/portal-dashboard-sidebar-client.webp"],
  ["ref-portal-dashboard-sidebar-vendor.jpg", "public/portal/portal-dashboard-sidebar-vendor.webp"],
  ["ref-portal-hero-selection.jpg", "public/auth/portal-hero-selection.webp"],
  ["ref-portal-hero-client.jpg", "public/auth/portal-hero-client.webp"],
  ["ref-portal-hero-vendor.jpg", "public/auth/portal-hero-vendor.webp"],
  ["ref-portal-hero-employee.jpg", "public/auth/portal-hero-employee.webp"],
];

for (const [srcName, destRel] of exports) {
  const input = path.join(ASSETS, srcName);
  const output = path.join(ROOT, destRel);
  await fsp.mkdir(path.dirname(output), { recursive: true });
  await sharp(input).webp({ quality: 92, effort: 6 }).toFile(output);
  console.log("wrote", destRel);
}
