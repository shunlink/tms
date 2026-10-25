/**
 * Build docs/ADVANCED_AI_FUTURE_SCOPE.docx from docs/ADVANCED_AI_FUTURE_SCOPE.md
 * Run: npm run docs:advanced-ai-docx
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
} from "docx";

const ROOT = process.cwd();
const mdPath = resolve(ROOT, "docs/ADVANCED_AI_FUTURE_SCOPE.md");
const outPath = resolve(ROOT, "docs/ADVANCED_AI_FUTURE_SCOPE.docx");

const md = readFileSync(mdPath, "utf8");
const lines = md.split(/\r?\n/);

function headingLevel(line) {
  const m = /^(#{1,4})\s+(.*)/.exec(line);
  if (!m) return null;
  const levels = {
    "#": HeadingLevel.TITLE,
    "##": HeadingLevel.HEADING_1,
    "###": HeadingLevel.HEADING_2,
    "####": HeadingLevel.HEADING_3,
  };
  return { level: levels[m[1]] ?? HeadingLevel.HEADING_2, text: m[2].trim() };
}

function parseTableRow(line) {
  if (!line.trim().startsWith("|")) return null;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.every((c) => /^[-:]+$/.test(c))) return "separator";
  return cells;
}

function stripMdInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

function bulletText(line) {
  const m = /^[-*]\s+(.*)/.exec(line);
  return m ? m[1] : null;
}

function numberedText(line) {
  const m = /^\d+\.\s+(.*)/.exec(line);
  return m ? m[1] : null;
}

const children = [];

// Cover block
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2400, after: 200 },
    children: [new TextRun({ text: "SHUNLINK", bold: true, size: 28, color: "B8860B" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: "Advanced AI Implementation",
        bold: true,
        size: 44,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: "Future Scope — AI-Powered 4PL Logistics",
        size: 26,
        color: "444444",
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
    children: [
      new TextRun({
        text: "Confidential · Product & investor reference",
        italics: true,
        size: 22,
        color: "666666",
      }),
    ],
  }),
  new Paragraph({ children: [new PageBreak()] })
);

let i = 0;
while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  if (!trimmed || trimmed === "---") {
    i++;
    continue;
  }

  const h = headingLevel(trimmed);
  if (h) {
    // Skip duplicate title from md (we have cover)
    if (h.level === HeadingLevel.TITLE) {
      i++;
      continue;
    }
    children.push(
      new Paragraph({
        heading: h.level,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: stripMdInline(h.text) })],
      })
    );
    i++;
    continue;
  }

  if (trimmed.startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith("|")) {
      const row = parseTableRow(lines[i]);
      if (row !== "separator" && row) rows.push(row);
      i++;
    }
    if (rows.length > 0) {
      const tableRows = rows.map(
        (cells, rowIdx) =>
          new TableRow({
            children: cells.map(
              (cell) =>
                new TableCell({
                  width: { size: 100 / cells.length, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: stripMdInline(cell),
                          bold: rowIdx === 0,
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          },
          rows: tableRows,
        }),
        new Paragraph({ spacing: { after: 120 }, children: [] })
      );
    }
    continue;
  }

  const bullet = bulletText(trimmed);
  const numbered = numberedText(trimmed);
  if (bullet || numbered) {
    const text = stripMdInline(bullet ?? numbered);
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: (numbered ? "• " : "• ") + text, size: 22 }),
        ],
      })
    );
    i++;
    continue;
  }

  children.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: stripMdInline(trimmed), size: 22 })],
    })
  );
  i++;
}

const doc = new Document({
  creator: "Shunlink TMS",
  title: "Advanced AI Implementation — Future Scope",
  description: "Future-scope advanced AI for AI-powered 4PL logistics",
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buffer);
console.log("Word document written:", outPath);
