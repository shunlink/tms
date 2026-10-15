/**
 * @deprecated Use reference-based exports instead (logo baked into reference art):
 *   node scripts/export-reference-portal-assets.mjs
 *
 * Legacy: composites /brand/logo-light.svg onto photos.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LOGO_SVG = path.join(ROOT, "public", "brand", "logo-light.svg");

const ASSETS = path.resolve(
  ROOT,
  "..",
  "..",
  ".cursor",
  "projects",
  "c-Users-vikra-Code-TMS",
  "assets"
);

/** Matches dashboard banner mockup: horizontal wordmark on trailer side */
const PLACEMENTS = {
  bannerTrailer: { left: 0.555, top: 0.355, widthFrac: 0.145, rotate: -1.5 },
  /** Same logo treatment on portrait login heroes (trailer side facing viewer) */
  authPortrait: { left: 0.58, top: 0.51, widthFrac: 0.24, rotate: -7 },
};

async function compositeLogo(inputPath, outputPath, placement) {
  const base = sharp(inputPath);
  const meta = await base.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error(`Could not read dimensions: ${inputPath}`);

  const logoW = Math.round(w * placement.widthFrac);
  const logoH = Math.round(logoW * (350 / 712));
  const left = Math.round(w * placement.left);
  const top = Math.round(h * placement.top);

  let logo = await sharp(LOGO_SVG).resize(logoW, logoH, { fit: "inside" }).png().toBuffer();
  if (placement.rotate) {
    logo = await sharp(logo)
      .rotate(placement.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
  }

  const logoMeta = await sharp(logo).metadata();
  const logoLeft = left - Math.round(((logoMeta.width ?? logoW) - logoW) / 2);
  const logoTop = top;

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });

  await base
    .composite([{ input: logo, left: Math.max(0, logoLeft), top: Math.max(0, logoTop) }])
    .webp({ quality: 90, effort: 6 })
    .toFile(outputPath);

  console.log("wrote", path.relative(ROOT, outputPath));
}

const authJobs = [
  {
    in: path.join(
      ASSETS,
      "c__Users_vikra_AppData_Roaming_Cursor_User_workspaceStorage_e348e466c4217b9f9f7bc09b0bdac339_images_portal-hero-selection-8688fdef-e5ba-45c4-b8d7-4e0eb66682a8.webp"
    ),
    out: path.join(ROOT, "public", "auth", "portal-hero-selection.webp"),
    placement: PLACEMENTS.authPortrait,
  },
  {
    in: path.join(
      ASSETS,
      "c__Users_vikra_AppData_Roaming_Cursor_User_workspaceStorage_e348e466c4217b9f9f7bc09b0bdac339_images_portal-hero-client-2f0802ac-7538-4f8d-8c6a-671ace0708df.webp"
    ),
    out: path.join(ROOT, "public", "auth", "portal-hero-client.webp"),
    placement: PLACEMENTS.authPortrait,
  },
  {
    in: path.join(
      ASSETS,
      "c__Users_vikra_AppData_Roaming_Cursor_User_workspaceStorage_e348e466c4217b9f9f7bc09b0bdac339_images_portal-hero-vendor-f671745b-0374-4a53-a69b-8ed44864e771.webp"
    ),
    out: path.join(ROOT, "public", "auth", "portal-hero-vendor.webp"),
    placement: PLACEMENTS.authPortrait,
  },
  {
    in: path.join(
      ASSETS,
      "c__Users_vikra_AppData_Roaming_Cursor_User_workspaceStorage_e348e466c4217b9f9f7bc09b0bdac339_images_portal-hero-client-2f0802ac-7538-4f8d-8c6a-671ace0708df.webp"
    ),
    out: path.join(ROOT, "public", "auth", "portal-hero-employee.webp"),
    placement: PLACEMENTS.authPortrait,
  },
];

const dashboardJobs = [
  {
    in: path.join(ASSETS, "portal-dashboard-hero-client-clean.jpg"),
    out: path.join(ROOT, "public", "portal", "portal-dashboard-hero-client.webp"),
    placement: PLACEMENTS.bannerTrailer,
  },
  {
    in: path.join(ASSETS, "portal-dashboard-hero-vendor-clean.jpg"),
    out: path.join(ROOT, "public", "portal", "portal-dashboard-hero-vendor.webp"),
    placement: PLACEMENTS.bannerTrailer,
  },
];

for (const job of [...authJobs, ...dashboardJobs]) {
  if (!fs.existsSync(job.in)) {
    console.error("missing input:", job.in);
    process.exitCode = 1;
    continue;
  }
  await compositeLogo(job.in, job.out, job.placement);
}
