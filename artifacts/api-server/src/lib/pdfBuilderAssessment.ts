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
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    doc.registerFont(F_REG, FONT_REGULAR);
    doc.registerFont(F_BOLD, FONT_BOLD);
    doc.font(F_REG);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, meta);
    let y = 158;

    // Student info card (compact)
    y = drawInfoCard(doc, meta, y);
    y += 10;

    // Domain scores first (visual summary)
    y = drawSection(doc, "영역별 평가", y);
    y = drawDomainScores(doc, report.domainScores, y, report.totalScore);
    y += 8;

    // Overall comment
    y = drawSection(doc, "총평", y);
    y = drawParagraph(doc, report.overallComment, y);
    y += 8;

    // Strengths
    y = drawSection(doc, "잘한 점", y, GREEN);
    y = drawBullets(doc, report.strengths, y, GREEN);
    y += 6;

    // Improvements
    y = drawSection(doc, "보완할 점", y, RED);
    y = drawBullets(doc, report.improvements, y, RED);
    y += 6;

    // Next steps
    y = drawSection(doc, "다음 학습 제안", y);
    y = drawBullets(doc, report.nextSteps, y, NAVY);

    // Footer signature
    drawSignature(doc, meta);
    drawPageFooters(doc);

    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, meta: AssessmentMeta) {
  doc.rect(0, 0, doc.page.width, 110).fill(NAVY);
  doc.fillColor("white").fontSize(17).font(F_BOLD).text(ACADEMY_NAME, 50, 16);
  doc
    .fillColor("#c9d4f0")
    .fontSize(11)
    .font(F_REG)
    .text("학업 성취도 평가서 (Achievement Test Report)", 50, 40);

  // 교재명 prominent
  doc
    .fillColor(GOLD)
    .fontSize(13)
    .font(F_BOLD)
    .text(`교재: ${meta.testTitle}`, 50, 62, {
      width: doc.page.width - 100,
    });

  doc
    .fillColor("white")
    .fontSize(10)
    .font(F_BOLD)
    .text(`담당: ${meta.teacherName}`, doc.page.width - 220, 20, {
      width: 170,
      align: "right",
    });
  doc
    .fillColor("#c9d4f0")
    .fontSize(9)
    .font(F_REG)
    .text(meta.date, doc.page.width - 220, 38, {
      width: 170,
      align: "right",
    });
}

function drawInfoCard(
  doc: PDFKit.PDFDocument,
  meta: AssessmentMeta,
  y: number,
): number {
  const x = 50;
  const w = doc.page.width - 100;
  const h = 46;
  doc.roundedRect(x, y, w, h, 8).fillAndStroke("#f7f3e8", GOLD);

  doc
    .fillColor("#6b5a1f")
    .font(F_REG)
    .fontSize(9)
    .text("학생 이름", x + 16, y + 8);
  doc
    .font(F_BOLD)
    .fontSize(16)
    .fillColor(NAVY)
    .text(meta.studentName, x + 16, y + 20);

  doc
    .font(F_REG)
    .fontSize(9)
    .fillColor("#6b5a1f")
    .text("평가일", x + w - 200, y + 8);
  doc
    .font(F_BOLD)
    .fontSize(12)
    .fillColor(NAVY)
    .text(meta.date, x + w - 200, y + 22);

  return y + h;
}

function drawSection(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
  color: string = NAVY,
): number {
  doc.rect(50, y, 3, 14).fill(color);
  doc
    .fillColor(color)
    .font(F_BOLD)
    .fontSize(12)
    .text(title, 60, y - 1);
  return y + 18;
}

function drawParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
): number {
  doc.fillColor("#222").font(F_REG).fontSize(10);
  const w = doc.page.width - 100;
  const h = doc.heightOfString(text, { width: w, lineGap: 2 });
  doc.text(text, 50, y, { width: w, lineGap: 2 });
  return y + h + 2;
}

function drawBullets(
  doc: PDFKit.PDFDocument,
  items: string[],
  y: number,
  bulletColor: string,
): number {
  const w = doc.page.width - 100 - 14;
  for (const item of items) {
    if (!item.trim()) continue;
    doc.fillColor("#222").font(F_REG).fontSize(9.8);
    const h = doc.heightOfString(item, { width: w, lineGap: 1.5 });
    doc.circle(55, y + 5, 1.8).fill(bulletColor);
    doc
      .fillColor("#222")
      .font(F_REG)
      .fontSize(9.8)
      .text(item, 64, y, { width: w, lineGap: 1.5 });
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
  const startX = 50;
  const fullW = doc.page.width - 100;

  // 2-column layout: 2 domains per row
  const colW = (fullW - 12) / 2;
  const labelW = 40;
  const valueW = 42;
  const barW = colW - labelW - valueW - 8;
  const rowH = 20;

  for (let i = 0; i < entries.length; i += 2) {
    for (let c = 0; c < 2; c++) {
      const e = entries[i + c];
      if (!e) continue;
      const x = startX + c * (colW + 12);
      doc
        .fillColor(NAVY)
        .font(F_BOLD)
        .fontSize(10)
        .text(e.label, x, y + 4, { width: labelW });

      const barX = x + labelW;
      doc.roundedRect(barX, y + 6, barW, 9, 4.5).fill("#e9ecf4");
      const fillW = Math.max(2, (barW * e.value) / 100);
      const color = e.value >= 80 ? GREEN : e.value >= 60 ? GOLD : RED;
      doc.roundedRect(barX, y + 6, fillW, 9, 4.5).fill(color);

      doc
        .fillColor(color)
        .font(F_BOLD)
        .fontSize(10.5)
        .text(`${e.value}점`, barX + barW + 4, y + 4, {
          width: valueW,
          align: "right",
        });
    }
    y += rowH;
  }

  if (typeof totalScore === "number" && Number.isFinite(totalScore)) {
    y += 2;
    const total = clamp(totalScore);
    doc.roundedRect(startX, y, fullW, 24, 6).fill(NAVY);
    doc
      .fillColor("white")
      .font(F_BOLD)
      .fontSize(11)
      .text("총점", startX + 14, y + 7);
    doc
      .fillColor(GOLD)
      .font(F_BOLD)
      .fontSize(14)
      .text(`${total}점`, startX, y + 5, {
        width: fullW - 14,
        align: "right",
      });
    y += 24;
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
    .moveTo(50, y)
    .lineTo(doc.page.width - 50, y)
    .stroke();
  doc
    .fillColor("#6b5a1f")
    .font(F_REG)
    .fontSize(8.5)
    .text(
      "본 평가서는 학생의 학업 성취도를 진단하고 학습 방향을 제안하기 위한 자료입니다. 추가 상담이 필요하시면 학원으로 연락 주시기 바랍니다.",
      50,
      y + 6,
      { width: doc.page.width - 100, lineGap: 1 },
    );
  doc
    .fillColor(NAVY)
    .font(F_BOLD)
    .fontSize(9.5)
    .text(`${ACADEMY_NAME}  ·  담당 ${meta.teacherName}`, 50, y + 28, {
      width: doc.page.width - 100,
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
        50,
        doc.page.height - 35,
        { width: doc.page.width - 100, align: "center" },
      );
  }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
