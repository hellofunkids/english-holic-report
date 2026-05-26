import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import PDFDocument from "pdfkit";
import { db, chaptersTable, booksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GeneratePdfParams, GeneratePdfBody } from "@workspace/api-zod";

const router = Router();

// Anthropic client using Replit AI Integrations proxy
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

// ── Level labels ────────────────────────────────────────────────────────────
const levelLabels: Record<string, string> = {
  elementary4: "Elementary School Grade 4",
  elementary5: "Elementary School Grade 5",
  elementary6: "Elementary School Grade 6",
  middle: "Middle School",
};

const levelKoLabels: Record<string, string> = {
  elementary4: "초등 4학년",
  elementary5: "초등 5학년",
  elementary6: "초등 6학년",
  middle: "중등",
};

// ── AI Question Generation ───────────────────────────────────────────────────
interface McQuestion {
  number: number;
  question: string;
  options: string[]; // ["A) ...", "B) ...", "C) ...", "D) ..."]
  answer: string;    // "A", "B", "C", or "D"
}

async function generateQuestions(
  bookTitle: string,
  chapterTitle: string,
  level: string
): Promise<McQuestion[]> {
  const levelLabel = levelLabels[level] || "Elementary School Grade 4";

  const prompt = `You are creating a reading comprehension quiz for Korean English academy students at the ${levelLabel} level.

Book: "${bookTitle}"
Chapter/Section: "${chapterTitle}"

Create exactly 20 multiple-choice comprehension questions about "${bookTitle}". 

Rules:
- Questions must be about ACTUAL events, characters, and facts from this book — no invented content
- Use simple, clear English vocabulary appropriate for ${levelLabel} Korean EFL students
- Each question must have exactly 4 options labeled A, B, C, D
- Cover different parts of the book — vary the topics (characters, plot events, settings, emotions, relationships)
- Do NOT include vocabulary definition questions — only comprehension/reading understanding questions
- Questions must NOT repeat similar ideas
- The correct answer must be factually accurate based on the real published book
- Questions should range from literal (who, what, where) to slightly inferential (why, how did X feel)
- Keep each question to 1-2 sentences maximum
- Keep each option to 1 short sentence maximum
- Do NOT include the chapter title or book cover description in the questions

Return ONLY valid JSON in this exact format, nothing else:
{
  "questions": [
    {
      "number": 1,
      "question": "Question text here?",
      "options": ["A) Option one", "B) Option two", "C) Option three", "D) Option four"],
      "answer": "A"
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.questions as McQuestion[];
}

// ── PDF Builder ──────────────────────────────────────────────────────────────
function buildQuizPdf(
  questions: McQuestion[],
  bookTitle: string,
  chapterTitle: string,
  level: string
): Buffer {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const navyColor = "#1a2e5a";
    const goldColor = "#c9a227";
    const levelKo = levelKoLabels[level] || "초등 4학년";

    // ── Header ────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(navyColor);
    doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
      .text("Book Quiz Lab", 50, 18, { align: "left" });
    doc.fontSize(13).font("Helvetica")
      .text("Reading Comprehension Quiz", 50, 46, { align: "left" });
    doc.fontSize(10)
      .text(`Level: ${levelKo}`, doc.page.width - 160, 18, { width: 110, align: "right" });

    // ── Book info ─────────────────────────────────────────────────────────
    doc.fillColor(navyColor).fontSize(16).font("Helvetica-Bold")
      .text(bookTitle, 50, 110);
    doc.fillColor(goldColor).fontSize(12).font("Helvetica")
      .text(chapterTitle, 50, 132);

    // ── Student info line ─────────────────────────────────────────────────
    doc.moveDown(0.5);
    doc.fillColor("#333").fontSize(11).font("Helvetica")
      .text("Name: ________________________________    Date: ________________    Score: _______ / 20", 50, 160);

    // Divider
    doc.moveTo(50, 182).lineTo(doc.page.width - 50, 182)
      .strokeColor(goldColor).lineWidth(2).stroke();

    // ── Questions ─────────────────────────────────────────────────────────
    let y = 196;
    const pageWidth = doc.page.width - 100;

    for (const q of questions) {
      // Check if we need a new page (with bottom margin)
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 50;
      }

      // Question number + text
      doc.fillColor(navyColor).fontSize(11).font("Helvetica-Bold");
      const questionText = `${q.number}. ${q.question}`;
      const questionHeight = doc.heightOfString(questionText, { width: pageWidth });
      doc.text(questionText, 50, y, { width: pageWidth });
      y += questionHeight + 6;

      // Options
      doc.fontSize(10.5).font("Helvetica").fillColor("#222");
      for (const opt of q.options) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
        const optHeight = doc.heightOfString(opt, { width: pageWidth - 20 });
        doc.text(opt, 68, y, { width: pageWidth - 20 });
        y += optHeight + 3;
      }
      y += 10; // gap between questions
    }

    // ── Footer ────────────────────────────────────────────────────────────
    const totalPages = (doc.bufferedPageRange?.() || { count: 1 }).count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fillColor("#aaa").fontSize(9).font("Helvetica")
        .text(`Book Quiz Lab  |  ${bookTitle}  |  Page ${i + 1}`, 50, doc.page.height - 35, {
          width: doc.page.width - 100,
          align: "center",
        });
    }

    doc.end();
  }) as unknown as Buffer;
}

function buildAnswerPdf(
  questions: McQuestion[],
  bookTitle: string,
  chapterTitle: string,
  level: string
): Buffer {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const navyColor = "#1a2e5a";
    const goldColor = "#c9a227";
    const greenColor = "#1a6b3a";
    const levelKo = levelKoLabels[level] || "초등 4학년";

    // ── Header ────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill(navyColor);
    doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
      .text("Book Quiz Lab", 50, 18);
    doc.fontSize(13).font("Helvetica")
      .text("Answer Key", 50, 46);
    doc.fontSize(10)
      .text(`Level: ${levelKo}`, doc.page.width - 160, 18, { width: 110, align: "right" });

    // ── Book info ─────────────────────────────────────────────────────────
    doc.fillColor(navyColor).fontSize(16).font("Helvetica-Bold")
      .text(bookTitle, 50, 110);
    doc.fillColor(goldColor).fontSize(12).font("Helvetica")
      .text(chapterTitle, 50, 132);

    doc.moveTo(50, 156).lineTo(doc.page.width - 50, 156)
      .strokeColor(goldColor).lineWidth(2).stroke();

    // ── Answer Grid (2 columns) ────────────────────────────────────────────
    doc.fillColor(navyColor).fontSize(13).font("Helvetica-Bold")
      .text("Answer Key", 50, 168);

    const col1X = 50;
    const col2X = 320;
    let y = 196;
    const mid = Math.ceil(questions.length / 2);

    for (let i = 0; i < mid; i++) {
      const q1 = questions[i];
      const q2 = questions[i + mid];

      // Column 1
      doc.fillColor("#333").fontSize(10.5).font("Helvetica")
        .text(`${q1.number}.`, col1X, y, { width: 20, continued: false });
      doc.fillColor(greenColor).font("Helvetica-Bold")
        .text(`${q1.answer}`, col1X + 22, y, { width: 20 });
      doc.fillColor("#555").font("Helvetica").fontSize(9)
        .text(q1.options.find(o => o.startsWith(q1.answer + ")"))?.replace(/^[ABCD]\)\s*/, "") ?? "", col1X + 44, y, { width: 210 });

      // Column 2
      if (q2) {
        doc.fillColor("#333").fontSize(10.5).font("Helvetica")
          .text(`${q2.number}.`, col2X, y, { width: 20 });
        doc.fillColor(greenColor).font("Helvetica-Bold")
          .text(`${q2.answer}`, col2X + 22, y, { width: 20 });
        doc.fillColor("#555").font("Helvetica").fontSize(9)
          .text(q2.options.find(o => o.startsWith(q2.answer + ")"))?.replace(/^[ABCD]\)\s*/, "") ?? "", col2X + 44, y, { width: 210 });
      }

      y += 28;
    }

    // ── Full questions with answers ────────────────────────────────────────
    y += 20;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y)
      .strokeColor("#ddd").lineWidth(1).stroke();
    y += 16;

    doc.fillColor(navyColor).fontSize(13).font("Helvetica-Bold")
      .text("Questions & Answers", 50, y);
    y += 22;

    const pageWidth = doc.page.width - 100;

    for (const q of questions) {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      // Question
      doc.fillColor(navyColor).fontSize(10.5).font("Helvetica-Bold");
      const qText = `${q.number}. ${q.question}`;
      const qHeight = doc.heightOfString(qText, { width: pageWidth });
      doc.text(qText, 50, y, { width: pageWidth });
      y += qHeight + 4;

      // Options — highlight correct one in green
      for (const opt of q.options) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
        const isCorrect = opt.startsWith(q.answer + ")");
        doc.fillColor(isCorrect ? greenColor : "#666")
          .font(isCorrect ? "Helvetica-Bold" : "Helvetica")
          .fontSize(10);
        const optHeight = doc.heightOfString(opt, { width: pageWidth - 20 });
        doc.text(`${isCorrect ? "✓ " : "  "}${opt}`, 64, y, { width: pageWidth - 20 });
        y += optHeight + 3;
      }
      y += 12;
    }

    // Footer
    doc.fillColor("#aaa").fontSize(9).font("Helvetica")
      .text(`Book Quiz Lab  |  ${bookTitle}  |  Answer Key`, 50, doc.page.height - 35, {
        width: doc.page.width - 100,
        align: "center",
      });

    doc.end();
  }) as unknown as Buffer;
}

// ── Route ─────────────────────────────────────────────────────────────────

/** POST /api/chapters/:chapterId/generate-pdf */
router.post("/chapters/:chapterId/generate-pdf", async (req, res) => {
  const { chapterId } = GeneratePdfParams.parse({ chapterId: Number(req.params.chapterId) });
  const body = GeneratePdfBody.parse(req.body);
  const { level, bookTitle, chapterTitle } = body;

  // Look up chapter + book info for context
  const [row] = await db
    .select({ chapter: chaptersTable, book: booksTable })
    .from(chaptersTable)
    .innerJoin(booksTable, eq(chaptersTable.bookId, booksTable.id))
    .where(eq(chaptersTable.id, chapterId));

  const resolvedBook = bookTitle || (row?.book?.title ?? "Unknown Book");
  const resolvedChapter = chapterTitle || (row?.chapter?.title ?? "");

  // Generate questions via AI
  req.log.info({ chapterId, level, book: resolvedBook }, "Generating PDF questions via AI");
  const questions = await generateQuestions(resolvedBook, resolvedChapter, level);

  // Generate both PDFs in parallel
  const [quizPdf, answerPdf] = await Promise.all([
    buildQuizPdf(questions, resolvedBook, resolvedChapter, level),
    buildAnswerPdf(questions, resolvedBook, resolvedChapter, level),
  ]);

  res.json({
    quizPdfBase64: quizPdf.toString("base64"),
    answerPdfBase64: answerPdf.toString("base64"),
    questions,
  });
});

export default router;
