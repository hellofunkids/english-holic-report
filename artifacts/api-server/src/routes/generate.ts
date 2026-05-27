import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  booksTable,
  materialsTable,
} from "@workspace/db";
import {
  buildVocabListPdf,
  buildVocabQuizPdf,
  buildReadingQuizPdf,
  buildAnswerKeyPdf,
} from "../lib/pdfBuilder";

// ── Strict AI response schemas ────────────────────────────────────────────
const VocabEntrySchema = z.object({
  word: z.string().min(1),
  pronunciation: z.string().min(1),
  meaning: z.string().min(1),
  example: z.string().min(1),
});

const VocabQuestionSchema = z.object({
  number: z.number().int().positive(),
  type: z.enum(["fill_blank", "match_meaning", "choose_word", "spelling"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
});

const ReadingQuestionSchema = z.object({
  number: z.number().int().positive(),
  question: z.string().min(1),
  options: z.array(z.string().regex(/^[A-D]\)/)).length(4),
  answer: z.enum(["A", "B", "C", "D"]),
});

const AiResponseSchema = z.object({
  vocabulary: z.array(VocabEntrySchema).min(5),
  vocabQuestions: z.array(VocabQuestionSchema).min(5),
  readingQuestions: z.array(ReadingQuestionSchema).min(5),
});

type AiResponse = z.infer<typeof AiResponseSchema>;

const router: IRouter = Router();

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const levelLabels: Record<string, string> = {
  elementary4: "Korean Elementary School Grade 4 (age 10)",
  elementary5: "Korean Elementary School Grade 5 (age 11)",
  elementary6: "Korean Elementary School Grade 6 (age 12)",
  middle: "Korean Middle School (age 13-15)",
};

async function generateAll(
  bookTitle: string,
  chapterTitle: string,
  level: string,
): Promise<AiResponse> {
  const levelLabel = levelLabels[level] ?? levelLabels.elementary4;

  const prompt = `You are creating reading study materials for ${levelLabel} students learning English at a Korean academy.

Book: "${bookTitle}"
Chapter/Section: "${chapterTitle}"

Generate three things in a SINGLE JSON response:

1. VOCABULARY LIST — exactly 20 important vocabulary words from this chapter of the book.
   - Choose words that are actually used in the book and appropriate for the level
   - For each: english word (lowercase, base form), Korean phonetic pronunciation, Korean meaning, and a SHORT English example sentence (5-12 words) that uses the word naturally
   - "pronunciation" is how to READ the English word in Korean Hangul (한글 발음), e.g. brave → "브레이브", suddenly → "써든리", escape → "이스케이프". This helps young Korean students pronounce the word.
   - Korean meanings should be natural Korean (한국어), like "용감한", "도망치다", "갑자기"

2. VOCABULARY QUIZ — exactly 20 questions, ONE QUESTION PER VOCABULARY WORD (in the same order as the vocabulary list). Mix these 4 types:
   - "fill_blank": Sentence with one ___ blank. Answer is the English word that fits.
   - "match_meaning": Show an English word, ask its Korean meaning, give 4 multiple choice options (Korean). Answer is one of the options (the Korean meaning text).
   - "choose_word": Show a Korean meaning + example sentence with blank, give 4 English word options. Answer is one of the options.
   - "spelling": Show the Korean meaning (and optionally Korean pronunciation in parentheses), ask the student to WRITE the English spelling. (No options.) Answer is the English word.
     Example question text: "용감한 (브레이브) — 영어 스펠링을 쓰세요."
   - Number them 1 to 20. Use a varied mix of all 4 types so every vocabulary word is tested exactly once.
   - For multiple choice questions, provide exactly 4 options as plain strings (no A) prefix). The "answer" field should be the EXACT text of the correct option.

3. READING COMPREHENSION QUIZ — exactly 20 multiple-choice questions about the book.
   - Questions test understanding of plot, characters, settings, emotions, relationships from the book
   - Each has exactly 4 options labeled "A) ...", "B) ...", "C) ...", "D) ..."
   - Answer is "A", "B", "C", or "D"
   - Cover different parts of the book, no repeated ideas
   - Keep question and options short and clear at the ${levelLabel} level

Return ONLY this JSON structure, no other text:
{
  "vocabulary": [
    { "word": "brave", "pronunciation": "브레이브", "meaning": "용감한", "example": "The brave boy helped his friend." }
  ],
  "vocabQuestions": [
    { "number": 1, "type": "fill_blank", "question": "The ___ boy helped his friend.", "answer": "brave" },
    { "number": 2, "type": "match_meaning", "question": "brave", "options": ["용감한", "슬픈", "조용한", "빠른"], "answer": "용감한" },
    { "number": 3, "type": "choose_word", "question": "용감한 — The ___ boy helped his friend.", "options": ["brave", "sad", "quiet", "fast"], "answer": "brave" },
    { "number": 4, "type": "spelling", "question": "용감한 (브레이브) — 영어 스펠링을 쓰세요.", "answer": "brave" }
  ],
  "readingQuestions": [
    { "number": 1, "question": "Where does the story begin?", "options": ["A) On a farm", "B) In a city", "C) At school", "D) In a forest"], "answer": "A" }
  ]
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");
  const raw = JSON.parse(jsonMatch[0]);
  const result = AiResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`AI response failed validation: ${result.error.message}`);
  }
  return result.data;
}

/** POST /books/:bookId/generate */
router.post("/books/:bookId/generate", async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  if (!Number.isFinite(bookId)) {
    res.status(400).json({ error: "invalid bookId" });
    return;
  }
  const chapterTitle: string = req.body?.chapterTitle ?? "";
  const level: string = req.body?.level ?? "elementary4";
  if (!chapterTitle) {
    res.status(400).json({ error: "chapterTitle is required" });
    return;
  }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, bookId));
  if (!book) {
    res.status(404).json({ error: "book not found" });
    return;
  }

  req.log.info({ bookId, chapterTitle, level }, "Generating materials via AI");
  let ai: AiResponse;
  try {
    ai = await generateAll(book.title, chapterTitle, level);
  } catch (err) {
    req.log.error({ err }, "AI generation failed");
    res.status(502).json({ error: "AI 생성 실패. 다시 시도해 주세요." });
    return;
  }

  // Build all 4 PDFs FIRST (atomicity: don't archive a material if PDFs can't render)
  let vocabList: Buffer, vocabQuiz: Buffer, readingQuiz: Buffer, answerKey: Buffer;
  try {
    [vocabList, vocabQuiz, readingQuiz, answerKey] = await Promise.all([
      buildVocabListPdf(ai.vocabulary, book.title, chapterTitle, level),
      buildVocabQuizPdf(ai.vocabQuestions, book.title, chapterTitle, level),
      buildReadingQuizPdf(ai.readingQuestions, book.title, chapterTitle, level),
      buildAnswerKeyPdf(ai.vocabQuestions, ai.readingQuestions, book.title, chapterTitle, level),
    ]);
  } catch (err) {
    req.log.error({ err, bookId, chapterTitle }, "PDF generation failed");
    res.status(500).json({ error: "PDF 생성 실패" });
    return;
  }

  // Only persist material after PDFs build successfully
  const [saved] = await db
    .insert(materialsTable)
    .values({
      bookId,
      bookTitle: book.title,
      chapterTitle,
      level,
      vocabulary: ai.vocabulary,
      vocabQuestions: ai.vocabQuestions,
      readingQuestions: ai.readingQuestions,
    })
    .returning();

  res.status(201).json({
    materialId: saved.id,
    vocabListPdfBase64: vocabList.toString("base64"),
    vocabQuizPdfBase64: vocabQuiz.toString("base64"),
    readingQuizPdfBase64: readingQuiz.toString("base64"),
    answerKeyPdfBase64: answerKey.toString("base64"),
  });
});

export default router;
