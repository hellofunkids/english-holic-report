import { Router, type IRouter, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, booksTable } from "@workspace/db";
import { buildOralQuizPdf } from "../lib/pdfBuilder";

const OralQuestionSchema = z.object({
  number: z.number().int().positive(),
  question: z.string().min(1),
  answer: z.string().min(1),
});

const OralAiResponseSchema = z.object({
  oralQuestions: z.array(OralQuestionSchema).length(10),
});

const LEVELS = ["elementary4", "elementary5", "elementary6", "middle"] as const;
const RequestBodySchema = z.object({
  level: z.enum(LEVELS),
  author: z.string().min(1).optional(),
});

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

/** POST /books/:bookId/oral-quiz */
router.post("/books/:bookId/oral-quiz", async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  if (!Number.isFinite(bookId)) {
    res.status(400).json({ error: "invalid bookId" });
    return;
  }
  const parsed = RequestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "잘못된 요청입니다 (level 값을 확인해 주세요)" });
    return;
  }
  const level = parsed.data.level;
  const author = parsed.data.author?.trim() || undefined;
  const levelLabel = levelLabels[level];

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, bookId));
  if (!book) {
    res.status(404).json({ error: "book not found" });
    return;
  }

  req.log.info({ bookId, level }, "Generating oral quiz via AI");

  const prompt = `You are a Korean English-academy teacher preparing ORAL COMPREHENSION questions for ${levelLabel} students.

Book: "${book.title}"${book.description ? `\nBook description: ${book.description}` : ""}

Create exactly 10 open-ended SPEAKING questions about the ENTIRE BOOK (not a single chapter). The teacher will ask the student these questions verbally to check their understanding of the whole story.

Requirements:
- Questions must be in English, short and clear, appropriate for ${levelLabel}.
- They are NOT multiple choice. They require the student to answer in English.
- Cover the whole book: main characters, setting, key events in order, character feelings and motivations, cause-and-effect, theme/message, and 1-2 opinion/prediction questions at the end.
- Difficulty progression: Q1-Q3 easy recall (who/where/what), Q4-Q7 understanding (why/how/what happened next), Q8-Q10 deeper inference / opinion / prediction.
- Each question must have a clear, complete MODEL ANSWER in English (1-2 short sentences, 8-25 words) that a student of this level could realistically produce. The model answer is for the teacher's scoring/reference.
- Base questions on the actual content of the book "${book.title}". Do not invent characters or events that don't belong to the book.

Return ONLY this JSON, no other text:
{
  "oralQuestions": [
    { "number": 1, "question": "Who is the main character in the story?", "answer": "The main character is a brave boy named Tom who lives on a farm." },
    { "number": 2, "question": "Why did Tom decide to help his friend?", "answer": "Because his friend was in trouble and Tom is very kind and brave." }
  ]
}`;

  let questions: z.infer<typeof OralQuestionSchema>[];
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI did not return valid JSON");
    const raw = JSON.parse(jsonMatch[0]);
    const parsed = OralAiResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`AI response failed validation: ${parsed.error.message}`);
    }
    questions = parsed.data.oralQuestions;
  } catch (err) {
    req.log.error({ err, bookId }, "Oral quiz AI generation failed");
    res.status(502).json({ error: "AI 생성 실패. 다시 시도해 주세요." });
    return;
  }

  let pdf: Buffer;
  try {
    pdf = await buildOralQuizPdf(questions, book.title, "전체 도서", level, author);
  } catch (err) {
    req.log.error({ err, bookId }, "Oral quiz PDF build failed");
    res.status(500).json({ error: "PDF 생성 실패" });
    return;
  }

  res.json({
    pdfBase64: pdf.toString("base64"),
    questionCount: questions.length,
  });
});

export default router;
