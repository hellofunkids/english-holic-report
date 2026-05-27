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
  questionAnalysis: Array<{
    number: string;
    correct: boolean;
    comment: string;
  }>;
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
    let y = 168;

    // Student info card
    y = drawInfoCard(doc, meta, y);
    y += 14;

    // Overall comment
    y = drawSection(doc, "총평", y);
    y = drawParagraph(doc, report.overallComment, y);
    y += 10;

    // Domain scores
    y = ensureSpace(doc, y, 120);
    y = drawSection(doc, "영역별 평가", y);
    y = drawDomainScores(doc, report.domainScores, y);
    y += 10;

    // Strengths
    y = ensureSpace(doc, y, 80);
    y = drawSection(doc, "잘한 점", y, GREEN);
    y = drawBullets(doc, report.strengths, y, GREEN);
    y += 8;

    // Improvements
    y = ensureSpace(doc, y, 80);
    y = drawSection(doc, "보완할 점", y, RED);
    y = drawBullets(doc, report.improvements, y, RED);
    y += 8;

    // Next steps
    y = ensureSpace(doc, y, 80);
    y = drawSection(doc, "다음 학습 제안", y);
    y = drawBullets(doc, report.nextSteps, y, NAVY);
    y += 12;

    // Question analysis
    if (report.questionAnalysis.length > 0) {
      y = ensureSpace(doc, y, 60);
      y = drawSection(doc, "문항별 분석", y);
      y = drawQuestionAnalysis(doc, report.questionAnalysis, y);
    }

    // Footer signature
    drawSignature(doc, meta);
    drawPageFooters(doc);

    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, meta: AssessmentMeta) {
  doc.rect(0, 0, doc.page.width, 100).fill(NAVY);
  doc.fillColor("white").fontSize(18).font(F_BOLD).text(ACADEMY_NAME, 50, 18);
  doc
    .fillColor("#c9d4f0")
    .fontSize(12)
    .font(F_REG)
    .text("학업 성취도 평가서 (Achievement Test Report)", 50, 46);

  doc
    .fillColor(GOLD)
    .fontSize(10)
    .font(F_BOLD)
    .text(`담당: ${meta.teacherName}`, doc.page.width - 200, 22, {
      width: 150,
      align: "right",
    });
  doc
    .fillColor("#c9d4f0")
    .fontSize(9)
    .font(F_REG)
    .text(meta.date, doc.page.width - 200, 40, {
      width: 150,
      align: "right",
    });
  doc.text(`교재: ${meta.testTitle}`, doc.page.width - 200, 54, {
    width: 150,
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
  doc.roundedRect(x, y, w, 60, 8).fillAndStroke("#f7f3e8", GOLD);

  doc
    .fillColor(NAVY)
    .font(F_BOLD)
    .fontSize(11)
    .text("학생 이름", x + 16, y + 12);
  doc
    .font(F_BOLD)
    .fontSize(20)
    .fillColor(NAVY)
    .text(meta.studentName, x + 16, y + 28);

  doc
    .font(F_REG)
    .fontSize(10)
    .fillColor("#6b5a1f")
    .text("평가일", x + w - 200, y + 14);
  doc
    .font(F_BOLD)
    .fontSize(13)
    .fillColor(NAVY)
    .text(meta.date, x + w - 200, y + 30);

  return y + 60;
}

function drawSection(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
  color: string = NAVY,
): number {
  doc.rect(50, y, 4, 16).fill(color);
  doc
    .fillColor(color)
    .font(F_BOLD)
    .fontSize(13)
    .text(title, 62, y);
  return y + 22;
}

function drawParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  y: number,
): number {
  doc.fillColor("#222").font(F_REG).fontSize(10.5);
  const w = doc.page.width - 100;
  const h = doc.heightOfString(text, { width: w, lineGap: 3 });
  if (y + h > doc.page.height - 80) {
    doc.addPage();
    y = 60;
  }
  doc.text(text, 50, y, { width: w, lineGap: 3 });
  return y + h + 4;
}

function drawBullets(
  doc: PDFKit.PDFDocument,
  items: string[],
  y: number,
  bulletColor: string,
): number {
  const w = doc.page.width - 100 - 16;
  for (const item of items) {
    if (!item.trim()) continue;
    doc.fillColor("#222").font(F_REG).fontSize(10.5);
    const h = doc.heightOfString(item, { width: w, lineGap: 2 });
    if (y + h > doc.page.height - 80) {
      doc.addPage();
      y = 60;
    }
    doc.circle(56, y + 6, 2.2).fill(bulletColor);
    doc
      .fillColor("#222")
      .font(F_REG)
      .fontSize(10.5)
      .text(item, 66, y, { width: w, lineGap: 2 });
    y += h + 4;
  }
  return y;
}

function drawDomainScores(
  doc: PDFKit.PDFDocument,
  scores: AssessmentReport["domainScores"],
  y: number,
): number {
  const entries = (Object.keys(DOMAIN_LABELS) as Array<keyof typeof DOMAIN_LABELS>).map(
    (k) => ({ label: DOMAIN_LABELS[k], value: clamp(scores[k]) }),
  );
  const startX = 50;
  const fullW = doc.page.width - 100;
  const labelW = 50;
  const valueW = 50;
  const barW = fullW - labelW - valueW - 16;
  const rowH = 22;

  for (const e of entries) {
    doc
      .fillColor(NAVY)
      .font(F_BOLD)
      .fontSize(10.5)
      .text(e.label, startX, y + 4, { width: labelW });

    // bar background
    const barX = startX + labelW + 8;
    doc.roundedRect(barX, y + 6, barW, 10, 5).fill("#e9ecf4");
    // bar fill
    const fillW = Math.max(2, (barW * e.value) / 100);
    const color = e.value >= 80 ? GREEN : e.value >= 60 ? GOLD : RED;
    doc.roundedRect(barX, y + 6, fillW, 10, 5).fill(color);

    doc
      .fillColor(color)
      .font(F_BOLD)
      .fontSize(11)
      .text(`${e.value}점`, barX + barW + 8, y + 4, {
        width: valueW,
        align: "right",
      });

    y += rowH;
  }
  return y;
}

function drawQuestionAnalysis(
  doc: PDFKit.PDFDocument,
  items: AssessmentReport["questionAnalysis"],
  y: number,
): number {
  const numW = 36;
  const markW = 28;
  const commentW = doc.page.width - 100 - numW - markW - 16;

  for (const it of items) {
    doc.fillColor("#222").font(F_REG).fontSize(10);
    const h = Math.max(
      18,
      doc.heightOfString(it.comment, { width: commentW, lineGap: 2 }) + 4,
    );
    if (y + h > doc.page.height - 80) {
      doc.addPage();
      y = 60;
    }
    // num
    doc.roundedRect(50, y, numW, h - 4, 4).fill("#f4f5f9");
    doc
      .fillColor(NAVY)
      .font(F_BOLD)
      .fontSize(10)
      .text(it.number, 50, y + 4, { width: numW, align: "center" });
    // mark
    const markColor = it.correct ? GREEN : RED;
    doc.roundedRect(50 + numW + 8, y, markW, h - 4, 4).fill(markColor);
    doc
      .fillColor("white")
      .font(F_BOLD)
      .fontSize(11)
      .text(it.correct ? "O" : "X", 50 + numW + 8, y + 4, {
        width: markW,
        align: "center",
      });
    // comment
    doc
      .fillColor("#222")
      .font(F_REG)
      .fontSize(10)
      .text(it.comment, 50 + numW + 8 + markW + 8, y + 2, {
        width: commentW,
        lineGap: 2,
      });
    y += h;
  }
  return y;
}

function drawSignature(doc: PDFKit.PDFDocument, meta: AssessmentMeta) {
  const range = doc.bufferedPageRange();
  doc.switchToPage(range.start + range.count - 1);
  const y = doc.page.height - 110;
  doc
    .strokeColor(GOLD)
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(doc.page.width - 50, y)
    .stroke();
  doc
    .fillColor("#6b5a1f")
    .font(F_REG)
    .fontSize(9)
    .text(
      "본 평가서는 학생의 학업 성취도를 진단하고 학습 방향을 제안하기 위한 자료입니다. 추가 상담이 필요하시면 학원으로 연락 주시기 바랍니다.",
      50,
      y + 8,
      { width: doc.page.width - 100, lineGap: 2 },
    );
  doc
    .fillColor(NAVY)
    .font(F_BOLD)
    .fontSize(11)
    .text(`${ACADEMY_NAME}  ·  담당 ${meta.teacherName}`, 50, y + 48, {
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

function ensureSpace(doc: PDFKit.PDFDocument, y: number, need: number): number {
  if (y + need > doc.page.height - 80) {
    doc.addPage();
    return 60;
  }
  return y;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
