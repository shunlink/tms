#!/usr/bin/env python3
"""Build styled PDF from SHUNLINK_PRODUCTION_DEPLOYMENT_GUIDE.md (HTML + Chromium)."""

from __future__ import annotations

import argparse
import re
import sys
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MD_PATH = ROOT / "docs" / "SHUNLINK_PRODUCTION_DEPLOYMENT_GUIDE.md"
CSS_PATH = ROOT / "docs" / "deployment-guide-print.css"
HTML_PATH = ROOT / "docs" / "SHUNLINK_PRODUCTION_DEPLOYMENT_GUIDE.html"
PDF_PATH = ROOT / "docs" / "SHUNLINK_PRODUCTION_DEPLOYMENT_GUIDE.pdf"


def load_markdown() -> str:
    if not MD_PATH.is_file():
        print(f"Missing {MD_PATH}", file=sys.stderr)
        sys.exit(1)
    return MD_PATH.read_text(encoding="utf-8")


def md_to_html(md: str) -> str:
    try:
        import markdown
    except ImportError:
        print("Install: pip install markdown", file=sys.stderr)
        sys.exit(1)

    return markdown.markdown(
        md,
        extensions=["tables", "fenced_code", "sane_lists", "toc"],
        output_format="html5",
    )


def extract_cover_meta(md: str) -> dict[str, str]:
    version = "2.0"
    date = ""
    m = re.search(r"\*\*Document version:\*\*\s*([^\n]+)", md)
    if m:
        version = m.group(1).strip()
    m = re.search(r"\*\*Date:\*\*\s*([^\n]+)", md)
    if m:
        date = m.group(1).strip()
    return {"version": version, "date": date}


def build_html(body_html: str, meta: dict[str, str]) -> str:
    css = CSS_PATH.read_text(encoding="utf-8") if CSS_PATH.is_file() else ""
    cover = textwrap.dedent(
        f"""
        <section class="cover">
          <h1>SHUN LINK Platform</h1>
          <p class="subtitle">Production Deployment Guide</p>
          <div class="meta">
            <p><strong>Version</strong> {meta['version']}</p>
            <p><strong>Date</strong> {meta['date']}</p>
            <p><strong>Scope</strong> Website, TMS, Bidding — 3-server layout (99 + 400 + 400 GB)</p>
            <p><strong>Backups</strong> External object storage (restic) — primary</p>
          </div>
        </section>
        """
    ).strip()

    # Skip duplicate H1 from markdown body
    body_html = re.sub(r"^<h1[^>]*>.*?</h1>\s*", "", body_html, count=1, flags=re.DOTALL)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>SHUN LINK — Production Deployment Guide</title>
  <style>
{css}
  </style>
</head>
<body>
{cover}
<article class="content">
{body_html}
</article>
</body>
</html>
"""


def write_html(html: str) -> None:
    HTML_PATH.write_text(html, encoding="utf-8")
    print(f"Wrote {HTML_PATH}")


def html_to_pdf_playwright(html_path: Path, pdf_path: Path) -> bool:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False

    file_url = html_path.resolve().as_uri()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(file_url, wait_until="networkidle")
            page.pdf(
                path=str(pdf_path),
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                display_header_footer=False,
            )
            browser.close()
        print(f"Wrote {pdf_path}")
        return True
    except Exception as exc:
        print(f"Playwright PDF failed: {exc}", file=sys.stderr)
        return False


def html_to_pdf_edge(html_path: Path, pdf_path: Path) -> bool:
    """Windows: headless Edge/Chrome print-to-PDF if available."""
    import shutil
    import subprocess

    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ]
    browser = next((c for c in candidates if Path(c).is_file()), None)
    if not browser:
        return False

    file_url = html_path.resolve().as_uri()
    pdf_abs = str(pdf_path.resolve())
    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_abs}",
        file_url,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
        if pdf_path.is_file() and pdf_path.stat().st_size > 1000:
            print(f"Wrote {pdf_path} (via headless browser)")
            return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        print(f"Headless browser PDF failed: {exc}", file=sys.stderr)
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--html-only", action="store_true", help="Generate HTML only")
    args = parser.parse_args()

    md = load_markdown()
    meta = extract_cover_meta(md)
    body = md_to_html(md)
    html = build_html(body, meta)
    write_html(html)

    if args.html_only:
        return

    if html_to_pdf_playwright(HTML_PATH, PDF_PATH):
        return
    if html_to_pdf_edge(HTML_PATH, PDF_PATH):
        return

    print(
        "PDF not generated automatically. Options:\n"
        f"  1) pip install playwright && playwright install chromium && re-run this script\n"
        f"  2) Open {HTML_PATH} in Edge/Chrome -> Print -> Save as PDF (enable Background graphics)\n",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
