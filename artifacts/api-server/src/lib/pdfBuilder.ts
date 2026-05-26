import PDFDocument from "pdfkit";
import type { VocabEntry, VocabQuestion, ReadingQuestion } from "@workspace/db";

const NAVY = "#1a2e5a";
const GOLD = "#c9a227";
const GREEN = "#1a6b3a";

const levelKo: Record<string, string> = {
  elementary4: "초등 4학년",
  elementary5: "초등 5학년",
  elementary6: "초등 6학년",
  middle: "중등",
};

function buildToBuffer(fn: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
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
) {
  doc.rect(0, 0, doc.page.width, 90).fill(NAVY);
  doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text("Book Quiz Lab", 50, 18);
  doc.fontSize(13).font("Helvetica").text(subtitle, 50, 46);
  doc
    .fontSize(10)
    .text(`Level: ${levelKo[level] ?? level}`, doc.page.width - 160, 18, {
      width: 110,
      align: "right",
    });

  doc.fillColor(NAVY).fontSize(16).font("Helvetica-Bold").text(bookTitle, 50, 110);
  doc.fillColor(GOLD).fontSize(12).font("Helvetica").text(chapterTitle, 50, 132);
}

function drawStudentLine(doc: PDFKit.PDFDocument, total: number, y: number) {
  doc
    .fillColor("#333")
    .fontSize(11)
    .font("Helvetica")
    .text(
      `Name: ________________________   Date: _______________   Score: ____ / ${total}`,
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
      .font("Helvetica")
      .text(`${label}  |  Page ${i - range.start + 1}`, 50, doc.page.height - 35, {
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
): Promise<Buffer> {
  return buildToBuffer((doc) => {
    drawHeader(doc, "Vocabulary List", bookTitle, chapterTitle, level);
    doc.moveTo(50, 156).lineTo(doc.page.width - 50, 156).strokeColor(GOLD).lineWidth(2).stroke();

    const cols = { num: 50, word: 80, meaning: 200, example: 320 };
    const colWidth = { word: 115, meaning: 115, example: doc.page.width - 50 - 320 };

    const drawTableHeader = (startY: number): number => {
      doc.fillColor(NAVY).fontSize(11).font("Helvetica-Bold");
      doc.text("#", cols.num, startY);
      doc.text("Word", cols.word, startY);
      doc.text("뜻", cols.meaning, startY);
      doc.text("Example", cols.example, startY);
      const next = startY + 18;
      doc
        .moveTo(50, next - 2)
        .lineTo(doc.page.width - 50, next - 2)
        .strokeColor("#ddd")
        .lineWidth(1)
        .stroke();
      doc.font("Helvetica").fillColor("#222").fontSize(10);
      return next;
    };

    let y = drawTableHeader(174);

    vocab.forEach((v, i) => {
      const meaningH = doc.heightOfString(v.meaning, { width: colWidth.meaning });
      const wordH = doc.heightOfString(v.word, { width: colWidth.word });
      const exampleH = doc.heightOfString(v.example, { width: colWidth.example });
      const rowH = Math.max(wordH, meaningH, exampleH, 14) + 10;

      if (y + rowH > doc.page.height - 60) {
        doc.addPage();
        y = drawTableHeader(50);
      }

      doc.fillColor("#666").text(String(i + 1), cols.num, y, { width: 22 });
      doc.fillColor(NAVY).font("Helvetica-Bold").text(v.word, cols.word, y, { width: colWidth.word });
      doc.fillColor("#222").font("Helvetica").text(v.meaning, cols.meaning, y, { width: colWidth.meaning });
      doc.fillColor("#555").font("Helvetica-Oblique").fontSize(9.5).text(v.example, cols.example, y, { width: colWidth.example });
      doc.font("Helvetica").fontSize(10);

      y += rowH;
      doc.moveTo(50, y - 4).lineTo(doc.page.width - 50, y - 4).strokeColor("#eee").lineWidth(0.5).stroke();
    });

    drawFooter(doc, `Book Quiz Lab  |  ${bookTitle}  |  Vocabulary`);
  });
}

// ── 2. Vocabulary Quiz PDF ────────────────────────────────────────────────
const vocabTypeLabel: Record<VocabQuestion["type"], string> = {
  fill_blank: "Fill in the blank",
  match_meaning: "Choose the meaning",
  choose_word: "Choose the correct word",
  translation: "Translate",
};

export function buildVocabQuizPdf(
  questions: VocabQuestion[],
  bookTitle: string,
  chapterTitle: string,
  level: string,
): Promise<Buffer> {
  return buildToBuffer((doc) => {
    drawHeader(doc, "Vocabulary Quiz", bookTitle, chapterTitle, level);
    drawStudentLine(doc, questions.length, 158);

    let y = 200;
    const pageW = doc.page.width - 100;
    for (const q of questions) {
      const qText = `${q.number}. [${vocabTypeLabel[q.type]}] ${q.question}`;
      const qH = doc.fillColor(NAVY).fontSize(11).font("Helvetica-Bold").heightOfString(qText, { width: pageW });
      if (y + qH > doc.page.height - 80) { doc.addPage(); y = 50; }
      doc.text(qText, 50, y, { width: pageW });
      y += qH + 6;

      if (q.options && q.options.length > 0) {
        doc.fontSize(10.5).font("Helvetica").fillColor("#222");
        for (let i = 0; i < q.options.length; i++) {
          const label = String.fromCharCode(65 + i);
          const optText = `${label}) ${q.options[i]}`;
          const optH = doc.heightOfString(optText, { width: pageW - 20 });
          if (y + optH > doc.page.height - 60) { doc.addPage(); y = 50; }
          doc.text(optText, 68, y, { width: pageW - 20 });
          y += optH + 3;
        }
      } else {
        // Answer line
        doc.fontSize(10.5).font("Helvetica").fillColor("#888");
        doc.text("Answer: ______________________________", 68, y + 4);
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
): Promise<Buffer> {
  return buildToBuffer((doc) => {
    drawHeader(doc, "Reading Comprehension Quiz", bookTitle, chapterTitle, level);
    drawStudentLine(doc, questions.length, 158);

    let y = 200;
    const pageW = doc.page.width - 100;
    for (const q of questions) {
      const qText = `${q.number}. ${q.question}`;
      const qH = doc.fillColor(NAVY).fontSize(11).font("Helvetica-Bold").heightOfString(qText, { width: pageW });
      if (y + qH > doc.page.height - 100) { doc.addPage(); y = 50; }
      doc.text(qText, 50, y, { width: pageW });
      y += qH + 6;

      doc.fontSize(10.5).font("Helvetica").fillColor("#222");
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
): Promise<Buffer> {
  return buildToBuffer((doc) => {
    drawHeader(doc, "Answer Key", bookTitle, chapterTitle, level);
    doc.moveTo(50, 156).lineTo(doc.page.width - 50, 156).strokeColor(GOLD).lineWidth(2).stroke();

    let y = 172;
    const pageW = doc.page.width - 100;

    // Section 1: Vocabulary Quiz answers
    doc.fillColor(NAVY).fontSize(14).font("Helvetica-Bold").text("Vocabulary Quiz", 50, y);
    y += 22;

    doc.fontSize(10).font("Helvetica");
    for (const q of vocabQuestions) {
      const line = `${q.number}. ${q.answer}`;
      const text = `${line}    (${vocabTypeLabel[q.type]})`;
      const h = doc.heightOfString(text, { width: pageW });
      if (y + h > doc.page.height - 80) { doc.addPage(); y = 50; }
      doc.fillColor("#333").text(`${q.number}.`, 50, y, { width: 28 });
      doc.fillColor(GREEN).font("Helvetica-Bold").text(q.answer, 78, y, { width: pageW - 28 });
      doc.font("Helvetica").fillColor("#333");
      y += Math.max(h, 14) + 2;
    }

    y += 16;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor("#ddd").lineWidth(1).stroke();
    y += 14;

    // Section 2: Reading Quiz answers — grid
    if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
    doc.fillColor(NAVY).fontSize(14).font("Helvetica-Bold").text("Reading Comprehension", 50, y);
    y += 22;

    const col1X = 50;
    const col2X = 320;
    const mid = Math.ceil(readingQuestions.length / 2);
    const startY = y;
    let leftY = y;
    let rightY = y;

    doc.fontSize(10.5).font("Helvetica");
    for (let i = 0; i < mid; i++) {
      const q1 = readingQuestions[i];
      const q2 = readingQuestions[i + mid];

      if (leftY > doc.page.height - 60) { doc.addPage(); leftY = 50; rightY = 50; }

      doc.fillColor("#333").font("Helvetica").text(`${q1.number}.`, col1X, leftY, { width: 28 });
      doc.fillColor(GREEN).font("Helvetica-Bold").text(q1.answer, col1X + 28, leftY, { width: 30 });
      const opt1 = q1.options.find((o) => o.startsWith(q1.answer + ")"))?.replace(/^[ABCD]\)\s*/, "") ?? "";
      doc.fillColor("#666").font("Helvetica").fontSize(9.5).text(opt1, col1X + 60, leftY, { width: 200 });
      doc.fontSize(10.5);

      if (q2) {
        doc.fillColor("#333").font("Helvetica").text(`${q2.number}.`, col2X, rightY, { width: 28 });
        doc.fillColor(GREEN).font("Helvetica-Bold").text(q2.answer, col2X + 28, rightY, { width: 30 });
        const opt2 = q2.options.find((o) => o.startsWith(q2.answer + ")"))?.replace(/^[ABCD]\)\s*/, "") ?? "";
        doc.fillColor("#666").font("Helvetica").fontSize(9.5).text(opt2, col2X + 60, rightY, { width: 200 });
        doc.fontSize(10.5);
      }

      leftY += 22;
      rightY += 22;
    }

    void startY;
    drawFooter(doc, `Book Quiz Lab  |  ${bookTitle}  |  Answer Key`);
  });
}
