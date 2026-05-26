import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, materialsTable } from "@workspace/db";
import {
  buildVocabListPdf,
  buildVocabQuizPdf,
  buildReadingQuizPdf,
  buildAnswerKeyPdf,
} from "../lib/pdfBuilder";

const router: IRouter = Router();

/** GET /books/:bookId/materials */
router.get("/books/:bookId/materials", async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  if (!Number.isFinite(bookId)) {
    res.status(400).json({ error: "invalid bookId" });
    return;
  }
  const rows = await db
    .select()
    .from(materialsTable)
    .where(eq(materialsTable.bookId, bookId))
    .orderBy(desc(materialsTable.createdAt));

  res.json(
    rows.map((m) => ({
      id: m.id,
      bookId: m.bookId,
      bookTitle: m.bookTitle,
      chapterTitle: m.chapterTitle,
      level: m.level,
      vocabCount: m.vocabulary.length,
      vocabQuizCount: m.vocabQuestions.length,
      readingQuizCount: m.readingQuestions.length,
      createdAt: m.createdAt,
    })),
  );
});

/** DELETE /materials/:materialId */
router.delete("/materials/:materialId", async (req: Request, res: Response) => {
  const id = Number(req.params.materialId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid materialId" });
    return;
  }
  await db.delete(materialsTable).where(eq(materialsTable.id, id));
  res.status(204).end();
});

/** POST /materials/:materialId/pdf — regenerate the 4 PDFs from saved JSON */
router.post("/materials/:materialId/pdf", async (req: Request, res: Response) => {
  const id = Number(req.params.materialId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid materialId" });
    return;
  }
  const [m] = await db.select().from(materialsTable).where(eq(materialsTable.id, id));
  if (!m) {
    res.status(404).json({ error: "material not found" });
    return;
  }

  let vocabList: Buffer, vocabQuiz: Buffer, readingQuiz: Buffer, answerKey: Buffer;
  try {
    [vocabList, vocabQuiz, readingQuiz, answerKey] = await Promise.all([
      buildVocabListPdf(m.vocabulary, m.bookTitle, m.chapterTitle, m.level),
      buildVocabQuizPdf(m.vocabQuestions, m.bookTitle, m.chapterTitle, m.level),
      buildReadingQuizPdf(m.readingQuestions, m.bookTitle, m.chapterTitle, m.level),
      buildAnswerKeyPdf(m.vocabQuestions, m.readingQuestions, m.bookTitle, m.chapterTitle, m.level),
    ]);
  } catch (err) {
    req.log.error({ err, materialId: id }, "PDF regeneration failed");
    res.status(500).json({ error: "PDF 생성 실패" });
    return;
  }

  res.json({
    vocabListPdfBase64: vocabList.toString("base64"),
    vocabQuizPdfBase64: vocabQuiz.toString("base64"),
    readingQuizPdfBase64: readingQuiz.toString("base64"),
    answerKeyPdfBase64: answerKey.toString("base64"),
  });
});

export default router;
