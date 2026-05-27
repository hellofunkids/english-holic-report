import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const NAVY = "#1a2e5a";
const GOLD = "#c9a227";
const GREEN = "#1a6b3a";
const RED = "#c0392b";

const ACADEMY_NAME = "헬로펀키즈 주니어 어학원";

const HERE =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const FONT_DIR_CANDIDATES = [
  path.resolve(HERE, "../assets/fonts"),
  path.resolve(HERE, "./assets/fonts"),
];

function fontPath(file: string): string {
  for (const dir of FONT_DIR_CANDIDATES) {
    const p = path.join(dir, file);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs") as typeof import("node:fs");
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return path.join(FONT_DIR_CANDIDATES[0], file);
}

const FONT_REGULAR = fontPath("NotoSansKR-Regular.ttf");
const FONT_BOLD = fontPath("NotoSansKR-Bold.ttf");
const F_REG = "Body";
const F_BOLD = "Bold";

export interface AssessmentReport {
  overallComment: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  domainScores: {
    vocabulary: number;
    grammar: number;
    reading: number;
    writing: number;
  };
  totalScore?: number;
}

export interface AssessmentMeta {
  studentName: string;
  teacherName: string;
  testTitle: string;
  date: string; // already formatted "YYYY-MM-DD"
}

const DOMAIN_LABELS: Record<keyof AssessmentReport["domainScores"], string> = {
  vocabulary: "어휘",
  grammar: "문법",
  reading: "독해",
  writing: "작문",
};

export function buildAssessmentReportPdf(
  report: AssessmentReport,
  meta: AssessmentMeta,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    doc.registerFont(F_REG, FONT_REGULAR);
    doc.registerFont(F_BOLD, FONT_BOLD);
    doc.font(F_REG);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Cap to first 3 items at render time as a safety net
    const strengths = report.strengths.slice(0, 3);
    const improvements = report.improvements.slice(0, 3);
    const nextSteps = report.nextSteps.slice(0, 3);

    // ── Page 1 ────────────────────────────────────────────────
    drawHeader(doc, meta);
    let y = 130;

    y = drawInfoCard(doc, meta, y);
    y += 8;

    y = drawSection(doc, "영역별 평가", y);
    y = drawDomainScores(doc, report.domainScores, y, report.totalScore);
    y += 6;

    y = drawSection(doc, "총평", y);
    y = drawParagraph(doc, report.overallComment, y, 760);
    y += 6;

    y = drawSection(doc, "잘한 점", y, GREEN);
    y = drawBullets(doc, strengths, y, GREEN, 760);

    // ── Page 2 ────────────────────────────────────────────────
    doc.addPage();
    let y2 = 50;

    y2 = drawSection(doc, "보완할 점", y2, RED);
    y2 = drawBullets(doc, improvements, y2, RED, doc.page.height - 180);
    y2 += 8;

    y2 = drawSection(doc, "다음 학습 제안", y2);
    y2 = drawBullets(doc, nextSteps, y2, NAVY, doc.page.height - 180);

    drawSignature(doc, meta);
    drawPageFooters(doc);

    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, meta: AssessmentMeta) {
  doc.rect(0, 0, doc.page.width, 85).fill(NAVY);
  doc.fillColor("white").fontSize(15).font(F_BOLD).text(ACADEMY_NAME, 40, 14);
  doc
    .fillColor("#c9d4f0")
    .fontSize(10)
    .font(F_REG)
    .text("학업 성취도 평가서 (Achievement Test Report)", 40, 34);

  // 교재명 prominent
  doc
    .fillColor(GOLD)
    .fontSize(12)
    .font(F_BOLD)
    .text(`교재: ${meta.testTitle}`, 40, 54, {
      width: doc.page.width - 240,
    });

  doc
    .fillColor("white")
    .fontSize(9.5)
    .font(F_BOLD)
    .text(`담당: ${meta.teacherName}`, doc.page.width - 200, 18, {
      width: 160,
      align: "right",
    });
  doc
    .fillColor("#c9d4f0")
    .fontSize(8.5)
    .font(F_REG)
    .text(meta.date, doc.page.width - 200, 34, {
      width: 160,
      align: "right",
    });
}

function drawInfoCard(
  doc: PDFKit.PDFDocument,
  meta: AssessmentMeta,
  y: number,
): number {
  const x = 40;
  const w = doc.page.width - 80;
  const h = 38;
  doc.roundedRect(x, y, w, h, 6).fillAndStroke("#f7f3e8", GOLD);

  doc
    .fillColor("#6b5a1f")
    .font(F_REG)
    .fontSize(8.5)
    .text("학생 이름", x + 14, y + 6);
  doc
    .font(F_BOLD)
    .fontSize(14)
    .fillColor(NAVY)
    .text(meta.studentName, x + 14, y + 17);

  doc
    .font(F_REG)
    .fontSize(8.5)
    .fillColor("#6b5a1f")
    .text("평가일", x + w - 180, y + 6);
  doc
    .font(F_BOLD)
    .fontSize(11)
    .fillColor(NAVY)
    .text(meta.date, x + w - 180, y + 18);

  return y + h;
}

function drawSection(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
  color: string = NAVY,
): number {
  doc.rect(40, y, 3, 12).fill(color);
  doc
    .fillColor(color)
    .font(F_BOLD)
    .fontSize(11)
    .text(title, 50, y - 1);
  return y + 16;
}

function drawParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
  maxY: number,
): number {
  doc.fillColor("#222").font(F_REG).fontSize(9.5);
  const w = doc.page.width - 80;
  const h = doc.heightOfString(text, { width: w, lineGap: 1.5 });
  // Guard: if it would overflow the allowed area, skip drawing rather than auto-paginate
  if (y + h > maxY) {
    return y;
  }
  doc.text(text, 40, y, { width: w, lineGap: 1.5 });
  return y + h + 2;
}

function drawBullets(
  doc: PDFKit.PDFDocument,
  items: string[],
  y: number,
  bulletColor: string,
  maxY: number,
): number {
  const w = doc.page.width - 80 - 14;
  for (const item of items) {
    if (!item.trim()) continue;
    doc.fillColor("#222").font(F_REG).fontSize(9.5);
    const h = doc.heightOfString(item, { width: w, lineGap: 1.2 });
    // Guard: stop emitting bullets that would push beyond the allowed area
    if (y + h > maxY) {
      break;
    }
    doc.circle(46, y + 5, 1.8).fill(bulletColor);
    doc
      .fillColor("#222")
      .font(F_REG)
      .fontSize(9.5)
      .text(item, 54, y, { width: w, lineGap: 1.2 });
    y += h + 3;
  }
  return y;
}

function drawDomainScores(
  doc: PDFKit.PDFDocument,
  scores: AssessmentReport["domainScores"],
  y: number,
  totalScore?: number,
): number {
  const entries = (Object.keys(DOMAIN_LABELS) as Array<keyof typeof DOMAIN_LABELS>).map(
    (k) => ({ label: DOMAIN_LABELS[k], value: clamp(scores[k]) }),
  );
  const startX = 40;
  const fullW = doc.page.width - 80;

  // 4 columns in a single row for maximum compactness
  const cols = 4;
  const gap = 8;
  const colW = (fullW - gap * (cols - 1)) / cols;
  const rowH = 36;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const x = startX + i * (colW + gap);
    const color = e.value >= 80 ? GREEN : e.value >= 60 ? GOLD : RED;

    doc.roundedRect(x, y, colW, rowH, 6).fillAndStroke("#f4f5f9", "#e0e3ec");
    doc
      .fillColor(NAVY)
      .font(F_BOLD)
      .fontSize(9)
      .text(e.label, x, y + 5, { width: colW, align: "center" });
    doc
      .fillColor(color)
      .font(F_BOLD)
      .fontSize(15)
      .text(`${e.value}`, x, y + 16, { width: colW, align: "center" });
  }
  y += rowH;

  if (typeof totalScore === "number" && Number.isFinite(totalScore)) {
    y += 4;
    const total = clamp(totalScore);
    const bandH = 22;
    doc.roundedRect(startX, y, fullW, bandH, 5).fill(NAVY);
    doc
      .fillColor("white")
      .font(F_BOLD)
      .fontSize(10)
      .text("총점", startX + 12, y + 6);
    doc
      .fillColor(GOLD)
      .font(F_BOLD)
      .fontSize(13)
      .text(`${total}점`, startX, y + 4, {
        width: fullW - 12,
        align: "right",
      });
    y += bandH;
  }

  return y;
}

function drawSignature(doc: PDFKit.PDFDocument, meta: AssessmentMeta) {
  const range = doc.bufferedPageRange();
  doc.switchToPage(range.start + range.count - 1);
  const y = doc.page.height - 70;
  doc
    .strokeColor(GOLD)
    .lineWidth(1)
    .moveTo(40, y)
    .lineTo(doc.page.width - 40, y)
    .stroke();
  doc
    .fillColor("#6b5a1f")
    .font(F_REG)
    .fontSize(8)
    .text(
      "본 평가서는 학생의 학업 성취도를 진단하고 학습 방향을 제안하기 위한 자료입니다. 추가 상담이 필요하시면 학원으로 연락 주시기 바랍니다.",
      40,
      y + 6,
      { width: doc.page.width - 80, lineGap: 1 },
    );
  doc
    .fillColor(NAVY)
    .font(F_BOLD)
    .fontSize(9)
    .text(`${ACADEMY_NAME}  ·  담당 ${meta.teacherName}`, 40, y + 28, {
      width: doc.page.width - 80,
      align: "right",
    });
}

function drawPageFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor("#aaa")
      .font(F_REG)
      .fontSize(9)
      .text(
        `${ACADEMY_NAME}  |  학업 성취도 평가서  |  Page ${i - range.start + 1}`,
        40,
        doc.page.height - 28,
        { width: doc.page.width - 80, align: "center" },
      );
  }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
