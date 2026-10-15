import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { marked } from "marked";
import puppeteer from "puppeteer-core";

const ROOT = process.cwd();
const md = readFileSync(resolve(ROOT, "ARCHITECTURE.md"), "utf8");
const body = marked.parse(md);

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

const css = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1e293b; font-size: 11.5px; line-height: 1.55; margin: 0; }
  h1 { font-size: 26px; color: #0f172a; margin: 0 0 4px; }
  h1 + h2 { margin-top: 0; color: #2563eb; font-weight: 600; border: 0; font-size: 15px; }
  h2 { font-size: 16px; color: #0f172a; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #e2e8f0; }
  h3 { font-size: 13.5px; color: #0f172a; margin: 16px 0 6px; }
  p { margin: 6px 0; }
  a { color: #2563eb; text-decoration: none; }
  ul, ol { margin: 6px 0 6px 18px; padding: 0; }
  li { margin: 2px 0; }
  strong { color: #0f172a; }
  blockquote { border-left: 3px solid #93c5fd; margin: 8px 0; padding: 4px 12px; color: #475569; background: #f8fafc; }
  code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 10.5px;
         background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }
  pre { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 8px;
        font-size: 9.6px; line-height: 1.45; overflow: hidden; white-space: pre-wrap; word-break: break-word; }
  pre code { background: transparent; color: inherit; padding: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5px; margin: 8px 0; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; color: #0f172a; }
  tr:nth-child(even) td { background: #f8fafc; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0; }
  h2 { break-after: avoid; }
  h3 { break-after: avoid; }
  pre, table, tr, blockquote { break-inside: avoid; }
  .cover { text-align: center; padding-top: 55mm; break-after: page; }
  .cover h1 { font-size: 40px; letter-spacing: -1px; }
  .cover .sub { font-size: 16px; color: #64748b; margin-top: 6px; }
  .cover .meta { margin-top: 28px; color: #94a3b8; font-size: 12px; }
  .cover .rule { width: 80px; height: 4px; background: #2563eb; margin: 22px auto; border-radius: 2px; }
`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <div class="cover">
    <h1>TMS — Transport Aggregator</h1>
    <div class="sub">System Design &amp; Architecture</div>
    <div class="rule"></div>
    <div class="meta">
      Version 1.0 &middot; Engineering Handover Document<br/>
      Next.js 14 &middot; Prisma &middot; SQLite/PostgreSQL
    </div>
  </div>
  <div style="break-before: page"></div>
  ${body}
</body></html>`;

const out = resolve(ROOT, "TMS-Architecture.pdf");
mkdirSync(dirname(out), { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div style="font-size:8px;color:#cbd5e1;width:100%;padding:0 16mm;text-align:right;">TMS — System Design &amp; Architecture</div>`,
  footerTemplate: `<div style="font-size:8px;color:#94a3b8;width:100%;padding:0 16mm;display:flex;justify-content:space-between;"><span>Confidential — internal engineering document</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  margin: { top: "20mm", bottom: "18mm", left: "15mm", right: "15mm" },
});
await browser.close();
console.log("PDF written:", out);
