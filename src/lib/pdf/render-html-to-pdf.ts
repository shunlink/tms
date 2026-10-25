import { existsSync } from "node:fs";

const DEFAULT_BROWSER_PATHS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean) as string[];

export function resolveBrowserExecutable(): string | null {
  const fromEnv = process.env.CHROME_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return DEFAULT_BROWSER_PATHS.find((p) => existsSync(p)) ?? null;
}

export type RenderPdfOptions = {
  format?: "A4";
  landscape?: boolean;
  marginMm?: { top?: number; right?: number; bottom?: number; left?: number };
};

/** Render HTML string to PDF bytes using puppeteer-core + local Chrome/Edge. */
export async function renderHtmlToPdf(html: string, opts: RenderPdfOptions = {}): Promise<Buffer> {
  const executablePath = resolveBrowserExecutable();
  if (!executablePath) {
    throw new Error(
      "PDF generation requires Chrome or Edge. Set CHROME_PATH to your browser executable."
    );
  }

  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              })
        )
      );
    });
    const margin = opts.marginMm ?? { top: 4, right: 4, bottom: 4, left: 4 };
    const pdf = await page.pdf({
      format: opts.format ?? "A4",
      landscape: opts.landscape ?? false,
      printBackground: true,
      margin: {
        top: `${margin.top ?? 4}mm`,
        right: `${margin.right ?? 4}mm`,
        bottom: `${margin.bottom ?? 4}mm`,
        left: `${margin.left ?? 4}mm`,
      },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
