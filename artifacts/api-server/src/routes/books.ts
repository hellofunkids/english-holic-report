import { Router } from "express";
import { db, booksTable, chaptersTable, vocabularyTable, quizzesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  CreateBookBody,
  UpdateBookBody,
  GetBookParams,
  UpdateBookParams,
  DeleteBookParams,
  ListChaptersParams,
  CreateChapterParams,
  CreateChapterBody,
  UpdateChapterParams,
  UpdateChapterBody,
  DeleteChapterParams,
  ListVocabularyParams,
  CreateVocabItemParams,
  CreateVocabItemBody,
  UpdateVocabItemParams,
  UpdateVocabItemBody,
  DeleteVocabItemParams,
  ListQuizzesParams,
  CreateQuizQuestionParams,
  CreateQuizQuestionBody,
  UpdateQuizQuestionParams,
  UpdateQuizQuestionBody,
  DeleteQuizQuestionParams,
} from "@workspace/api-zod";

const router = Router();

// ── Books ──────────────────────────────────────────────────────────────────

/** GET /api/books — list all books */
router.get("/books", async (req, res) => {
  const books = await db.select().from(booksTable).orderBy(asc(booksTable.createdAt));
  res.json(books.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })));
});

/** POST /api/books — create a book */
router.post("/books", async (req, res) => {
  const body = CreateBookBody.parse(req.body);
  const [book] = await db.insert(booksTable).values(body).returning();
  res.status(201).json({ ...book, createdAt: book.createdAt.toISOString() });
});

/** GET /api/books/:bookId — get a single book */
router.get("/books/:bookId", async (req, res) => {
  const { bookId } = GetBookParams.parse({ bookId: Number(req.params.bookId) });
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, bookId));
  if (!book) { res.status(404).json({ error: "Book not found" }); return; }
  res.json({ ...book, createdAt: book.createdAt.toISOString() });
});

/** PATCH /api/books/:bookId — update a book */
router.patch("/books/:bookId", async (req, res) => {
  const { bookId } = UpdateBookParams.parse({ bookId: Number(req.params.bookId) });
  const body = UpdateBookBody.parse(req.body);
  const [book] = await db.update(booksTable).set(body).where(eq(booksTable.id, bookId)).returning();
  if (!book) { res.status(404).json({ error: "Book not found" }); return; }
  res.json({ ...book, createdAt: book.createdAt.toISOString() });
});

/** DELETE /api/books/:bookId — delete a book */
router.delete("/books/:bookId", async (req, res) => {
  const { bookId } = DeleteBookParams.parse({ bookId: Number(req.params.bookId) });
  await db.delete(booksTable).where(eq(booksTable.id, bookId));
  res.status(204).send();
});

// ── Chapters ───────────────────────────────────────────────────────────────

/** GET /api/books/:bookId/chapters — list chapters for a book */
router.get("/books/:bookId/chapters", async (req, res) => {
  const { bookId } = ListChaptersParams.parse({ bookId: Number(req.params.bookId) });
  const chapters = await db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, bookId))
    .orderBy(asc(chaptersTable.orderIndex), asc(chaptersTable.createdAt));
  res.json(chapters.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

/** POST /api/books/:bookId/chapters — create a chapter */
router.post("/books/:bookId/chapters", async (req, res) => {
  const { bookId } = CreateChapterParams.parse({ bookId: Number(req.params.bookId) });
  const body = CreateChapterBody.parse(req.body);
  const [chapter] = await db.insert(chaptersTable).values({ ...body, bookId }).returning();
  res.status(201).json({ ...chapter, createdAt: chapter.createdAt.toISOString() });
});

/** PATCH /api/books/:bookId/chapters/:chapterId — update a chapter */
router.patch("/books/:bookId/chapters/:chapterId", async (req, res) => {
  const { chapterId } = UpdateChapterParams.parse({
    bookId: Number(req.params.bookId),
    chapterId: Number(req.params.chapterId),
  });
  const body = UpdateChapterBody.parse(req.body);
  const [chapter] = await db.update(chaptersTable).set(body).where(eq(chaptersTable.id, chapterId)).returning();
  if (!chapter) { res.status(404).json({ error: "Chapter not found" }); return; }
  res.json({ ...chapter, createdAt: chapter.createdAt.toISOString() });
});

/** DELETE /api/books/:bookId/chapters/:chapterId — delete a chapter */
router.delete("/books/:bookId/chapters/:chapterId", async (req, res) => {
  const { chapterId } = DeleteChapterParams.parse({
    bookId: Number(req.params.bookId),
    chapterId: Number(req.params.chapterId),
  });
  await db.delete(chaptersTable).where(eq(chaptersTable.id, chapterId));
  res.status(204).send();
});

// ── Vocabulary ─────────────────────────────────────────────────────────────

/** GET /api/chapters/:chapterId/vocabulary — list vocab for a chapter */
router.get("/chapters/:chapterId/vocabulary", async (req, res) => {
  const { chapterId } = ListVocabularyParams.parse({ chapterId: Number(req.params.chapterId) });
  const vocab = await db
    .select()
    .from(vocabularyTable)
    .where(eq(vocabularyTable.chapterId, chapterId))
    .orderBy(asc(vocabularyTable.createdAt));
  res.json(vocab.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })));
});

/** POST /api/chapters/:chapterId/vocabulary — create a vocab item */
router.post("/chapters/:chapterId/vocabulary", async (req, res) => {
  const { chapterId } = CreateVocabItemParams.parse({ chapterId: Number(req.params.chapterId) });
  const body = CreateVocabItemBody.parse(req.body);
  const [item] = await db.insert(vocabularyTable).values({ ...body, chapterId }).returning();
  res.status(201).json({ ...item, createdAt: item.createdAt.toISOString() });
});

/** PATCH /api/vocabulary/:vocabId — update a vocab item */
router.patch("/vocabulary/:vocabId", async (req, res) => {
  const { vocabId } = UpdateVocabItemParams.parse({ vocabId: Number(req.params.vocabId) });
  const body = UpdateVocabItemBody.parse(req.body);
  const [item] = await db.update(vocabularyTable).set(body).where(eq(vocabularyTable.id, vocabId)).returning();
  if (!item) { res.status(404).json({ error: "Vocab item not found" }); return; }
  res.json({ ...item, createdAt: item.createdAt.toISOString() });
});

/** DELETE /api/vocabulary/:vocabId — delete a vocab item */
router.delete("/vocabulary/:vocabId", async (req, res) => {
  const { vocabId } = DeleteVocabItemParams.parse({ vocabId: Number(req.params.vocabId) });
  await db.delete(vocabularyTable).where(eq(vocabularyTable.id, vocabId));
  res.status(204).send();
});

// ── Quizzes ────────────────────────────────────────────────────────────────

/** GET /api/chapters/:chapterId/quizzes — list quizzes for a chapter */
router.get("/chapters/:chapterId/quizzes", async (req, res) => {
  const { chapterId } = ListQuizzesParams.parse({ chapterId: Number(req.params.chapterId) });
  const quizzes = await db
    .select()
    .from(quizzesTable)
    .where(eq(quizzesTable.chapterId, chapterId))
    .orderBy(asc(quizzesTable.orderIndex), asc(quizzesTable.createdAt));
  res.json(
    quizzes.map((q) => ({
      ...q,
      options: (q.options as string[] | null) ?? null,
      createdAt: q.createdAt.toISOString(),
    }))
  );
});

/** POST /api/chapters/:chapterId/quizzes — create a quiz question */
router.post("/chapters/:chapterId/quizzes", async (req, res) => {
  const { chapterId } = CreateQuizQuestionParams.parse({ chapterId: Number(req.params.chapterId) });
  // Strip null options before Zod validation (short_answer questions have no options)
  const rawBody = { ...req.body };
  if (rawBody.options === null || rawBody.options === undefined) delete rawBody.options;
  const body = CreateQuizQuestionBody.parse(rawBody);
  const [quiz] = await db.insert(quizzesTable).values({ ...body, chapterId }).returning();
  res.status(201).json({
    ...quiz,
    options: (quiz.options as string[] | null) ?? null,
    createdAt: quiz.createdAt.toISOString(),
  });
});

/** PATCH /api/quizzes/:quizId — update a quiz question */
router.patch("/quizzes/:quizId", async (req, res) => {
  const { quizId } = UpdateQuizQuestionParams.parse({ quizId: Number(req.params.quizId) });
  const rawBody = { ...req.body };
  if (rawBody.options === null || rawBody.options === undefined) delete rawBody.options;
  const body = UpdateQuizQuestionBody.parse(rawBody);
  const [quiz] = await db.update(quizzesTable).set(body).where(eq(quizzesTable.id, quizId)).returning();
  if (!quiz) { res.status(404).json({ error: "Quiz not found" }); return; }
  res.json({
    ...quiz,
    options: (quiz.options as string[] | null) ?? null,
    createdAt: quiz.createdAt.toISOString(),
  });
});

/** DELETE /api/quizzes/:quizId — delete a quiz question */
router.delete("/quizzes/:quizId", async (req, res) => {
  const { quizId } = DeleteQuizQuestionParams.parse({ quizId: Number(req.params.quizId) });
  await db.delete(quizzesTable).where(eq(quizzesTable.id, quizId));
  res.status(204).send();
});

export default router;
