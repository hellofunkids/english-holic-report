import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import type { VocabEntry, VocabQuestion, ReadingQuestion } from "@workspace/db";

const NAVY = "#1a2e5a";
const GOLD = "#c9a227";
const GREEN = "#1a6b3a";

const ACADEMY_NAME = "헬로펀키즈 주니어 어학원";

// Resolve fonts relative to this module so both dev (src/) and bundled (dist/) work
const HERE =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// In dev:    artifacts/api-server/src/lib  -> ../assets/fonts
// In build:  artifacts/api-server/dist     -> ./assets/fonts (copied by build.mjs)
const FONT_DIR_CANDIDATES = [
  path.resolve(HERE, "../assets/fonts"),
  path.resolve(HERE, "./assets/fonts"),
];

function fontPath(file: string): string {
  // Pick the first candidate that exists; pdfkit will throw clearly if missing
  // We don't actually stat — pdfkit reads lazily; just return the first plausible path
  // and fall back to the second if needed by trying both.
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

// Font aliases used throughout this file
const F_REG = "Body";
const F_BOLD = "Bold";

const levelKo: Record<string, string> = {
  elementary4: "초등 4학년",
  elementary5: "초등 5학년",
  elementary6: "초등 6학년",
  middle: "중등",
};

function buildToBuffer(fn: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    // Register Korean-capable fonts on every doc
    doc.registerFont(F_REG, FONT_REGULAR);
    doc.registerFont(F_BOLD, FONT_BOLD);
    doc.font(F_REG);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    fn(doc);
    doc.end();
  });
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  subtitle: string,
  bookTitle: string,
  chapterTitle: string,
  level: string,
  author?: string,
) {
  doc.rect(0, 0, doc.page.width, 90).fill(NAVY);
  doc.fillColor("white").fontSize(18).font(F_BOLD).text(ACADEMY_NAME, 50, 16);
  doc.fontSize(12).font(F_REG).fillColor("#c9d4f0").text(subtitle, 50, 42);

  // Right column: level on top, author below
  doc
    .fillColor("white")
    .fontSize(10)
    .font(F_REG)
    .text(`레벨: ${levelKo[level] ?? level}`, doc.page.width - 200, 18, {
      width: 150,
      align: "right",
    });
  if (author) {
    doc
      .fillColor(GOLD)
      .fontSize(10)
      .font(F_BOLD)
      .text(`담당: ${author}`, doc.page.width - 200, 34, {
        width: 150,
        align: "right",
      });
  }
  doc
    .fillColor("#c9d4f0")
    .fontSize(9)
    .font(F_REG)
    .text(new Date().toLocaleDateString("ko-KR"), doc.page.width - 200, 50, {
      width: 150,
      align: "right",
    });

  doc.fillColor(NAVY).fontSize(16).font(F_BOLD).text(bookTitle, 50, 102);
  doc.fillColor(GOLD).fontSize(12).font(F_REG).text(chapterTitle, 50, 124);
}

function drawStudentLine(doc: PDFKit.PDFDocument, total: number, y: number) {
  doc
    .fillColor("#333")
    .fontSize(11)
    .font(F_REG)
    .text(
      `이름: ________________________   날짜: _______________   점수: ____ / ${total}`,
      50,
      y,
    );
  doc
    .moveTo(50, y + 22)
    .lineTo(doc.page.width - 50, y + 22)
    .strokeColor(GOLD)
    .lineWidth(2)
    .stroke();
}

function drawFooter(doc: PDFKit.PDFDocument, label: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor("#aaa")
      .fontSize(9)
      .font(F_REG)
      .text(`${ACADEMY_NAME}  |  ${label}  |  Page ${i - range.start + 1}`, 50, doc.page.height - 35, {
        width: doc.page.width - 100,
        align: "center",
      });
  }
}

// ── 1. Vocabulary List PDF ────────────────────────────────────────────────
export function buildVocabListPdf(
  vocab: VocabEntry[],
  bookTitle: string,
  chapterTitle: string,
  level: string,
  author?: string,
): Promise<Buffer> {
  return buildToBuffer((doc) => {
    drawHeader(doc, "단어장 (Vocabulary List)", bookTitle, chapterTitle, level, author);
    doc.moveTo(50, 150).lineTo(doc.page.width - 50, 150).strokeColor(GOLD).lineWidth(2).stroke();

    const cols = { num: 50, word: 80, meaning: 220, example: 340 };
    const colWidth = { word: 135, meaning: 115, example: doc.page.width - 50 - 340 };

    const drawTableHeader = (startY: number): number => {
      doc.fillColor(NAVY).fontSize(11).font(F_BOLD);
      doc.text("#", cols.num, startY);
      doc.text("Word / 발음", cols.word, startY);
      doc.text("뜻", cols.meaning, startY);
      doc.text("Example", cols.example, startY);
      const next = startY + 18;
      doc
        .moveTo(50, next - 2)
        .lineTo(doc.page.width - 50, next - 2)
        .strokeColor("#ddd")
        .lineWidth(1)
        .stroke();
      doc.font(F_REG).fillColor("#222").fontSize(10);
      return next;
    };

    let y = drawTableHeader(168);

    vocab.forEach((v, i) => {
      const pronText = v.pronunciation ? `[${v.pronunciation}]` : "";
      const wordH = doc.font(F_BOLD).fontSize(11).heightOfString(v.word, { width: colWidth.word });
      const pronH = pronText
        ? doc.font(F_REG).fontSize(9).heightOfString(pronText, { width: colWidth.word })
        : 0;
      const wordBlockH = wordH + (pronH ? pronH + 1 : 0);
      const meaningH = doc.font(F_REG).fontSize(10).heightOfString(v.meaning, { width: colWidth.meaning });
      const exampleH = doc.font(F_REG).fontSize(9.5).heightOfString(v.example, { width: colWidth.example });
      const rowH = Math.max(wordBlockH, meaningH, exampleH, 14) + 10;

      if (y + rowH > doc.page.height - 60) {
        doc.addPage();
        y = drawTableHeader(50);
      }

      doc.fillColor("#666").font(F_REG).fontSize(10).text(String(i + 1), cols.num, y, { width: 22 });
      doc.fillColor(NAVY).font(F_BOLD).fontSize(11).text(v.word, cols.word, y, { width: colWidth.word });
      if (pronText) {
        doc.fillColor(GOLD).font(F_REG).fontSize(9).text(pronText, cols.word, y + wordH + 1, { width: colWidth.word });
      }
      doc.fillColor("#222").font(F_REG).fontSize(10).text(v.meaning, cols.meaning, y, { width: colWidth.meaning });
      doc.fillColor("#555").font(F_REG).fontSize(9.5).text(v.example, cols.example, y, { width: colWidth.example });

      y += rowH;
      doc.moveTo(50, y - 4).lineTo(doc.page.width - 50, y - 4).strokeColor("#eee").lineWidth(0.5).stroke();
    });

    drawFooter(doc, `Book Quiz Lab  |  ${bookTitle}  |  Vocabulary`);
  });
}

// ── 2. Vocabulary Quiz PDF ────────────────────────────────────────────────
const vocabTypeLabel: Record<VocabQuestion["type"], string> = {
  fill_blank: "빈칸 채우기",
  match_meaning: "뜻 고르기",
  choose_word: "단어 고르기",
  spelling: "스펠링 쓰기",
};

export function buildVocabQuizPdf(
  questions: VocabQuestion[],
  bookTitle: string,
  chapterTitle: string,
  level: string,
  author?: string,
): Promise<Buffer> {
  return buildToBuffer((doc) => {
    drawHeader(doc, "어휘 퀴즈 (Vocabulary Quiz)", bookTitle, chapterTitle, level, author);
    drawStudentLine(doc, questions.length, 152);

    let y = 200;
    const pageW = doc.page.width - 100;
    for (const q of questions) {
      const qText = `${q.number}. [${vocabTypeLabel[q.type]}] ${q.question}`;
      const qH = doc.fillColor(NAVY).fontSize(11).font(F_BOLD).heightOfString(qText, { width: pageW });
      if (y + qH > doc.page.height - 80) { doc.addPage(); y = 50; }
      doc.text(qText, 50, y, { width: pageW });
      y += qH + 6;

      if (q.options && q.options.length > 0) {
        doc.fontSize(10.5).font(F_REG).fillColor("#222");
        for (let i = 0; i < q.options.length; i++) {
          const label = String.fromCharCode(65 + i);
          const optText = `${label}) ${q.options[i]}`;
          const optH = doc.heightOfString(optText, { width: pageW - 20 });
          if (y + optH > doc.page.height - 60) { doc.addPage(); y = 50; }
          doc.text(optText, 68, y, { width: pageW - 20 });
          y += optH + 3;
        }
      } else {
        doc.fontSize(10.5).font(F_REG).fillColor("#888");
        doc.text("정답: ______________________________", 68, y + 4);
        y += 22;
      }
      y += 12;
    }

    drawFooter(doc, `Book Quiz Lab  |  ${bookTitle}  |  Vocab Quiz`);
  });
}

// ── 3. Reading Comprehension Quiz PDF ─────────────────────────────────────
export function buildReadingQuizPdf(
  questions: ReadingQuestion[],
  bookTitle: string,
  chapterTitle: string,
  level: string,
  author?: string,
): Promise<Buffer> {
  return buildToBuffer((doc) => {
    drawHeader(doc, "독해 퀴즈 (Reading Comprehension)", bookTitle, chapterTitle, level, author);
    drawStudentLine(doc, questions.length, 152);

    let y = 200;
    const pageW = doc.page.width - 100;
    for (const q of questions) {
      const qText = `${q.number}. ${q.question}`;
      const qH = doc.fillColor(NAVY).fontSize(11).font(F_BOLD).heightOfString(qText, { width: pageW });
      if (y + qH > doc.page.height - 100) { doc.addPage(); y = 50; }
      doc.text(qText, 50, y, { width: pageW });
      y += qH + 6;

      doc.fontSize(10.5).font(F_REG).fillColor("#222");
      for (const opt of q.options) {
        const optH = doc.heightOfString(opt, { width: pageW - 20 });
        if (y + optH > doc.page.height - 60) { doc.addPage(); y = 50; }
        doc.text(opt, 68, y, { width: pageW - 20 });
        y += optH + 3;
      }
      y += 12;
    }

    drawFooter(doc, `Book Quiz Lab  |  ${bookTitle}  |  Reading Quiz`);
  });
}

// ── 4. Combined Answer Key PDF ────────────────────────────────────────────
export function buildAnswerKeyPdf(
  vocabQuestions: VocabQuestion[],
  readingQuestions: ReadingQuestion[],
  bookTitle: string,
  chapterTitle: string,
  level: string,
  author?: string,
): Promise<Buffer> {
  return buildToBuffer((doc) => {
    drawHeader(doc, "정답지 (Answer Key)", bookTitle, chapterTitle, level, author);
    doc.moveTo(50, 150).lineTo(doc.page.width - 50, 150).strokeColor(GOLD).lineWidth(2).stroke();

    let y = 166;
    const pageW = doc.page.width - 100;

    doc.fillColor(NAVY).fontSize(14).font(F_BOLD).text("어휘 퀴즈 정답", 50, y);
    y += 22;

    doc.fontSize(10).font(F_REG);
    for (const q of vocabQuestions) {
      const text = `${q.number}. ${q.answer}    (${vocabTypeLabel[q.type]})`;
      const h = doc.heightOfString(text, { width: pageW });
      if (y + h > doc.page.height - 80) { doc.addPage(); y = 50; }
      doc.fillColor("#333").font(F_REG).text(`${q.number}.`, 50, y, { width: 28 });
      doc.fillColor(GREEN).font(F_BOLD).text(q.answer, 78, y, { width: pageW - 28 });
      doc.font(F_REG).fillColor("#333");
      y += Math.max(h, 14) + 2;
    }

    y += 16;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#ddd").lineWidth(1).stroke();
    y += 14;

    if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
    doc.fillColor(NAVY).fontSize(14).font(F_BOLD).text("독해 퀴즈 정답", 50, y);
    y += 22;

    const col1X = 50;
    const col2X = 320;
    const mid = Math.ceil(readingQuestions.length / 2);
    let leftY = y;
    let rightY = y;

    doc.fontSize(10.5).font(F_REG);
    for (let i = 0; i < mid; i++) {
      const q1 = readingQuestions[i];
      const q2 = readingQuestions[i + mid];

      if (leftY > doc.page.height - 60) { doc.addPage(); leftY = 50; rightY = 50; }

      doc.fillColor("#333").font(F_REG).text(`${q1.number}.`, col1X, leftY, { width: 28 });
      doc.fillColor(GREEN).font(F_BOLD).text(q1.answer, col1X + 28, leftY, { width: 30 });
      const opt1 = q1.options.find((o) => o.startsWith(q1.answer + ")"))?.replace(/^[ABCD]\)\s*/, "") ?? "";
      doc.fillColor("#666").font(F_REG).fontSize(9.5).text(opt1, col1X + 60, leftY, { width: 200 });
      doc.fontSize(10.5);

      if (q2) {
        doc.fillColor("#333").font(F_REG).text(`${q2.number}.`, col2X, rightY, { width: 28 });
        doc.fillColor(GREEN).font(F_BOLD).text(q2.answer, col2X + 28, rightY, { width: 30 });
        const opt2 = q2.options.find((o) => o.startsWith(q2.answer + ")"))?.replace(/^[ABCD]\)\s*/, "") ?? "";
        doc.fillColor("#666").font(F_REG).fontSize(9.5).text(opt2, col2X + 60, rightY, { width: 200 });
        doc.fontSize(10.5);
      }

      leftY += 22;
      rightY += 22;
    }

    drawFooter(doc, `Book Quiz Lab  |  ${bookTitle}  |  Answer Key`);
  });
}
