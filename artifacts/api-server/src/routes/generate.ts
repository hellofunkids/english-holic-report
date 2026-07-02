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
  elementary1: "Korean Elementary School Grade 1 (age 7)",
  elementary2: "Korean Elementary School Grade 2 (age 8)",
  elementary3: "Korean Elementary School Grade 3 (age 9)",
  elementary4: "Korean Elementary School Grade 4 (age 10)",
  elementary5: "Korean Elementary School Grade 5 (age 11)",
  elementary6: "Korean Elementary School Grade 6 (age 12)",
  middle1: "Korean Middle School Grade 1 (age 13)",
  middle2: "Korean Middle School Grade 2 (age 14)",
  middle3: "Korean Middle School Grade 3 (age 15)",
  high1: "Korean High School Grade 1 (age 16)",
};

// Per-grade vocabulary difficulty guide — controls how hard the 20 words are,
// independently of the reading-comprehension level.
const vocabGuides: Record<string, string> = {
  elementary1: "Pick the easiest, most common everyday words (CEFR pre-A1/A1). Short words, concrete nouns/verbs a 7-year-old beginner can learn.",
  elementary2: "Easy high-frequency words (A1). Concrete, familiar objects, actions, and feelings.",
  elementary3: "Easy-to-moderate everyday words (A1-A2). Common adjectives and simple verbs.",
  elementary4: "Moderate everyday words (A2). Useful general vocabulary, some less-common words.",
  elementary5: "Moderate words (A2-B1). Mix common words with a few richer descriptive words.",
  elementary6: "Moderate-to-richer words (B1). Include some abstract and descriptive vocabulary.",
  middle1: "Richer vocabulary (B1). Abstract nouns, varied verbs and adjectives.",
  middle2: "Challenging vocabulary (B1-B2). Less-common, precise, and figurative words where they appear.",
  middle3: "Challenging vocabulary (B2). Nuanced, academic, and idiomatic words from the text.",
  high1: "Advanced vocabulary (B2-C1). Sophisticated, academic, and nuanced words, including idioms and figurative usage.",
};

// Per-grade reading-comprehension design guide. Each entry tells the AI exactly
// how hard the reading questions should be and which skills to test, so the same
// book produces age-appropriate questions across 초1 ~ 중3.
const readingGuides: Record<string, string> = {
  elementary1: `READING LEVEL — Korean Elementary Grade 1 (age 7, true beginner):
   - Questions and options must be VERY short and simple (each option 1-4 words).
   - Use only the most basic, high-frequency words. No idioms, no abstract words.
   - Test ONLY literal recall that is stated directly in the text: who, what, where, simple yes/no facts, naming a character or object, what color/number something is.
   - Avoid inference, cause/effect, theme, or feelings. One clearly correct answer that a child can point to in the story.`,
  elementary2: `READING LEVEL — Korean Elementary Grade 2 (age 8, beginner):
   - Short, concrete questions and options (options 1-5 words).
   - Mostly literal recall (who/what/where/when), plus a few very easy "what happened first/next" sequencing questions.
   - Simple feelings only when clearly stated (e.g. "happy", "sad"). No abstract themes.`,
  elementary3: `READING LEVEL — Korean Elementary Grade 3 (age 9, lower-intermediate):
   - Mix literal recall with EASY inference: simple cause and effect ("Why did X happen?"), basic character feelings, and ordering of events.
   - Options can be short sentences (up to ~6 words). One best answer, distractors clearly wrong.`,
  elementary4: `READING LEVEL — Korean Elementary Grade 4 (age 10, intermediate):
   - Balance literal recall and inference. Include: main idea of a part, character motivation, cause/effect, predicting what happens next, and simple vocabulary-in-context.
   - Distractors should be plausible but clearly distinguishable on careful reading.`,
  elementary5: `READING LEVEL — Korean Elementary Grade 5 (age 11, upper-intermediate):
   - Emphasize inference over recall: character motivation and change, comparing characters, cause/effect chains, the lesson/message of a section, and vocabulary-in-context (meaning of a word AS USED in the story).
   - Distractors should require the student to actually understand the passage, not just match keywords.`,
  elementary6: `READING LEVEL — Korean Elementary Grade 6 (age 12, advanced elementary):
   - Mostly inference and analysis: theme, author's purpose, tone/mood, comparing/contrasting characters or events, drawing conclusions, and figurative language if present.
   - Include some questions that need synthesis across two parts of the story. Strong, tempting distractors.`,
  middle1: `READING LEVEL — Korean Middle School Grade 1 (age 13):
   - Analytical questions: theme and central message, character development, author's purpose, inference from textual evidence, tone and mood, and vocabulary-in-context with nuance.
   - Options may be full clauses. Distractors should be subtle and require close reading.`,
  middle2: `READING LEVEL — Korean Middle School Grade 2 (age 14):
   - Higher-order thinking: deeper theme analysis, how characters/relationships evolve, author's craft and word choice, implied meaning, comparing perspectives, and supporting an interpretation with evidence.
   - Distractors should be very close, differing by a subtle but important detail.`,
  middle3: `READING LEVEL — Korean Middle School Grade 3 (age 15):
   - Sophisticated analysis: abstract theme and its development, symbolism and figurative language, author's intent and stylistic choices, nuanced inference, evaluating characters' decisions, and synthesizing meaning across the whole text.
   - Options are full, well-formed statements. Distractors are highly plausible and demand careful, critical reasoning to eliminate.`,
  high1: `READING LEVEL — Korean High School Grade 1 (age 16, most advanced):
   - The most demanding analysis: nuanced theme and its development, symbolism, irony, figurative language, author's intent and rhetorical/stylistic choices, critical evaluation of characters' decisions and the narrative, and synthesizing meaning across the whole text.
   - Options are full, well-formed statements. Distractors are highly plausible and require precise, critical reasoning to eliminate.`,
};

async function generateAll(
  bookTitle: string,
  chapterTitle: string,
  vocabLevel: string,
  readingLevel: string,
  chapterText?: string,
): Promise<AiResponse> {
  const vocabLevelLabel = levelLabels[vocabLevel] ?? levelLabels.elementary4;
  const readingLevelLabel = levelLabels[readingLevel] ?? levelLabels.elementary4;
  const vocabGuide = vocabGuides[vocabLevel] ?? vocabGuides.elementary4;
  const readingGuide = readingGuides[readingLevel] ?? readingGuides.elementary4;

  const hasText = !!chapterText?.trim();

  const textBlock = hasText
    ? `\n\nCHAPTER TEXT (use ONLY this text as your source — do not add facts, events, characters, or words not found here):\n"""\n${chapterText!.trim()}\n"""\n`
    : "";

  const vocabSourceRule = hasText
    ? `- Choose words that ACTUALLY APPEAR in the chapter text above. Do not use words that are not in the text.`
    : `- Choose words that are actually used in this chapter of the book. Calibrate word difficulty to the VOCABULARY level (${vocabLevelLabel}): ${vocabGuide}`;

  const readingSourceRule = hasText
    ? `- STRICT SOURCE RULE: EVERY question must be answerable using ONLY the chapter text provided above. Do NOT invent events, characters, or facts that are not explicitly stated in the text. Every correct answer must be directly supported by a specific sentence or passage in the text.`
    : `- CONTENT RULE (very important): EVERY question must be about the actual STORY CONTENT of the book — the events, the characters and what they do/say/feel, their relationships, the setting, and how the story unfolds. Do NOT ask about anything outside the story itself: NOT the series number or which book in the series this is, NOT the author/publisher, NOT page or chapter numbers, NOT the book title, and no other bibliographic or meta facts. If the chapter/section spans only part of the book, base questions on what happens in that part.`;

  const prompt = `You are creating reading study materials for students learning English at a Korean academy. The VOCABULARY is targeted at ${vocabLevelLabel}, and the READING COMPREHENSION is targeted at ${readingLevelLabel}. These two difficulty levels are SEPARATE and may differ — calibrate each section to its own level.

Book: "${bookTitle}"
Chapter/Section: "${chapterTitle}"${textBlock}

Generate three things in a SINGLE JSON response:

1. VOCABULARY LIST — exactly 20 important vocabulary words from this chapter of the book.
   ${vocabSourceRule}
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
   - Each has exactly 4 options labeled "A) ...", "B) ...", "C) ...", "D) ..."
   - Answer is "A", "B", "C", or "D"
   ${readingSourceRule}
   - Cover different parts of the story, no repeated ideas
   - Calibrate the difficulty, question types, and language EXACTLY to the READING level — this is the most important rule for the reading quiz:
   ${readingGuide}
   - Progress roughly from easier to harder within the 20 questions, but every question must stay appropriate for ${readingLevelLabel}.

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
  // Vocabulary and reading difficulty are chosen independently. Fall back to the
  // legacy single `level` field (and then elementary4) for backward compatibility.
  const legacyLevel: string =
    typeof req.body?.level === "string" ? req.body.level : "elementary4";
  const vocabLevel: string =
    typeof req.body?.vocabLevel === "string" ? req.body.vocabLevel : legacyLevel;
  const readingLevel: string =
    typeof req.body?.readingLevel === "string" ? req.body.readingLevel : legacyLevel;
  const author: string | undefined =
    typeof req.body?.author === "string" && req.body.author.trim()
      ? req.body.author.trim()
      : undefined;
  const chapterText: string | undefined =
    typeof req.body?.chapterText === "string" && req.body.chapterText.trim()
      ? req.body.chapterText.trim()
      : undefined;
  if (!chapterTitle) {
    res.status(400).json({ error: "chapterTitle is required" });
    return;
  }

  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, bookId));
  if (!book) {
    res.status(404).json({ error: "book not found" });
    return;
  }

  req.log.info({ bookId, chapterTitle, vocabLevel, readingLevel, hasText: !!chapterText }, "Generating materials via AI");
  let ai: AiResponse;
  try {
    ai = await generateAll(book.title, chapterTitle, vocabLevel, readingLevel, chapterText);
  } catch (err) {
    req.log.error({ err }, "AI generation failed");
    res.status(502).json({ error: "AI 생성 실패. 다시 시도해 주세요." });
    return;
  }

  // Build all 4 PDFs FIRST (atomicity: don't archive a material if PDFs can't render).
  // Vocab materials show the vocab level; reading materials show the reading level.
  let vocabList: Buffer, vocabQuiz: Buffer, readingQuiz: Buffer, answerKey: Buffer;
  try {
    [vocabList, vocabQuiz, readingQuiz, answerKey] = await Promise.all([
      buildVocabListPdf(ai.vocabulary, book.title, chapterTitle, vocabLevel, author),
      buildVocabQuizPdf(ai.vocabQuestions, book.title, chapterTitle, vocabLevel, author),
      buildReadingQuizPdf(ai.readingQuestions, book.title, chapterTitle, readingLevel, author),
      buildAnswerKeyPdf(ai.vocabQuestions, ai.readingQuestions, book.title, chapterTitle, readingLevel, author),
    ]);
  } catch (err) {
    req.log.error({ err, bookId, chapterTitle }, "PDF generation failed");
    res.status(500).json({ error: "PDF 생성 실패" });
    return;
  }

  // Only persist material after PDFs build successfully.
  // `level` keeps the (notNull) legacy column meaningful = the reading level.
  const [saved] = await db
    .insert(materialsTable)
    .values({
      bookId,
      bookTitle: book.title,
      chapterTitle,
      level: readingLevel,
      vocabLevel,
      readingLevel,
      author,
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
