import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { marked } from "marked";
import puppeteer from "puppeteer-core";

const ROOT = process.cwd();
const MD_PATH = resolve(ROOT, "docs/PLATFORM_EASE_PLAN.md");
const md = readFileSync(MD_PATH, "utf8");

// Rewrite relative doc links for print
const mdPrint = md
  .replace(/\]\(\.\/SHUNLINK_AI_IMPLEMENTATION\.md\)/g, "] (see SHUNLINK_AI_IMPLEMENTATION.md in repo)")
  .replace(/\]\(\.\/AI_AUTOMATION_ROADMAP\.md\)/g, "] (see AI_AUTOMATION_ROADMAP.md in repo)");

const body = marked.parse(mdPrint);

const BROWSERS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) {
  console.error("No Chrome/Edge browser found. Set CHROME_PATH env var.");
  process.exit(1);
}

const BRAND_GOLD = "#EAB308";
const BRAND_GOLD_DARK = "#CA8A04";
const BRAND_SLATE = "#0f172a";

const css = `
  * { box-sizing: border-box; }
  @page { size: A4; }
  body {
    font-family: "Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif;
    color: #334155;
    font-size: 10.5px;
    line-height: 1.55;
    margin: 0;
  }
  h1 { font-size: 22px; color: ${BRAND_SLATE}; margin: 0 0 6px; font-weight: 700; letter-spacing: -0.02em; }
  h2 {
    font-size: 14px;
    color: ${BRAND_SLATE};
    margin: 20px 0 8px;
    padding: 6px 0 6px 10px;
    border-left: 4px solid ${BRAND_GOLD};
    background: linear-gradient(90deg, #fffbeb 0%, transparent 100%);
    break-after: avoid;
  }
  h3 { font-size: 12px; color: ${BRAND_SLATE}; margin: 14px 0 6px; break-after: avoid; }
  p { margin: 6px 0; }
  a { color: #1d4ed8; text-decoration: none; }
  ul, ol { margin: 6px 0 6px 18px; padding: 0; }
  li { margin: 3px 0; }
  strong { color: ${BRAND_SLATE}; font-weight: 600; }
  blockquote {
    border-left: 3px solid ${BRAND_GOLD};
    margin: 8px 0;
    padding: 6px 12px;
    color: #475569;
    background: #fffbeb;
    border-radius: 0 6px 6px 0;
  }
  code {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 9.5px;
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 4px;
    color: #0f172a;
  }
  pre {
    background: ${BRAND_SLATE};
    color: #e2e8f0;
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 9px;
    line-height: 1.5;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    border: 1px solid #1e293b;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9.5px;
    margin: 10px 0;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }
  th, td {
    border: 1px solid #e2e8f0;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: ${BRAND_SLATE};
    color: #f8fafc;
    font-weight: 600;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 18px 0; }
  pre, table, tr, blockquote { break-inside: avoid; }

  .cover {
    min-height: 250mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    break-after: page;
    padding: 0 20mm;
    background: linear-gradient(165deg, #fffbeb 0%, #ffffff 45%, #f8fafc 100%);
  }
  .cover .logo {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.35em;
    color: ${BRAND_GOLD_DARK};
    margin-bottom: 12px;
  }
  .cover h1 {
    font-size: 32px;
    line-height: 1.15;
    max-width: 140mm;
    margin-bottom: 10px;
  }
  .cover .sub {
    font-size: 15px;
    color: #64748b;
    font-weight: 500;
    max-width: 120mm;
    line-height: 1.45;
  }
  .cover .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 28px;
  }
  .cover .pill {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 6px 12px;
    border-radius: 999px;
    background: ${BRAND_SLATE};
    color: #fef9c3;
  }
  .cover .rule {
    width: 72px;
    height: 5px;
    background: linear-gradient(90deg, ${BRAND_GOLD}, ${BRAND_GOLD_DARK});
    margin: 24px auto;
    border-radius: 3px;
  }
  .cover .meta {
    margin-top: 8px;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.6;
  }
  .cover .tagline {
    margin-top: 32px;
    padding: 14px 20px;
    border: 1px solid #fde68a;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.85);
    font-size: 11px;
    color: #475569;
    max-width: 130mm;
  }
  .toc-note {
    font-size: 9px;
    color: #64748b;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: #f1f5f9;
    border-radius: 8px;
    break-after: avoid;
  }
`;

const generated = new Date().toLocaleDateString("en-IN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Shunlink — Platform Ease Plan</title>
  <style>${css}</style>
</head>
<body>
  <div class="cover">
    <div class="logo">SHUNLINK</div>
    <h1>Automation &amp; AI<br/>Now vs Future</h1>
    <div class="sub">Practical automation and intelligence on the live Shunlink TMS — real use cases only</div>
    <div class="rule"></div>
    <div class="pill-row">
      <span class="pill">Client portal</span>
      <span class="pill">Vendor portal</span>
      <span class="pill">Now vs future</span>
      <span class="pill">Operations</span>
    </div>
    <div class="tagline">
      Implement now: tracking, alerts, ranked loads, payment clarity · Future: copilots when self-serve is live
    </div>
    <div class="meta">
      Product &amp; engineering roadmap<br/>
      Generated ${generated} · Confidential
    </div>
  </div>
  <div class="toc-note">
    Source: <code>docs/PLATFORM_EASE_PLAN.md</code> · Extended AI map: <code>docs/SHUNLINK_AI_IMPLEMENTATION.md</code>
  </div>
  ${body}
</body>
</html>`;

const outDir = resolve(ROOT, "docs/pdf");
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, "Shunlink-Platform-Ease-Plan.pdf");

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load", timeout: 60000 });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `
    <div style="font-size:7.5px;color:#cbd5e1;width:100%;padding:0 14mm;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#ca8a04;font-weight:700;letter-spacing:0.12em;">SHUNLINK</span>
      <span>Platform Ease Plan</span>
    </div>`,
  footerTemplate: `
    <div style="font-size:7.5px;color:#94a3b8;width:100%;padding:0 14mm;display:flex;justify-content:space-between;">
      <span>Confidential — Shunlink TMS</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`,
  margin: { top: "22mm", bottom: "18mm", left: "14mm", right: "14mm" },
});
await browser.close();
console.log("PDF written:", out);
