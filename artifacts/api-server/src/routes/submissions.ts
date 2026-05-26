import { Router } from "express";
import { db, submissionsTable, vocabularyTable, quizzesTable, chaptersTable, booksTable } from "@workspace/db";
import { eq, desc, asc, sql } from "drizzle-orm";
import { CreateSubmissionBody, GetSubmissionParams } from "@workspace/api-zod";

const router = Router();

// ── Helper: score a submission ─────────────────────────────────────────────

interface AnswerInput {
  questionId: number;
  questionType: string;
  answer: string;
}

interface AnswerDetail {
  questionId: number;
  questionType: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string | null;
}

/** Normalize answers for loose matching (trim + lowercase) */
function normalize(str: string) {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Score all answers for a chapter submission and return detailed results */
async function scoreSubmission(
  chapterId: number,
  answers: AnswerInput[]
): Promise<{ details: AnswerDetail[]; vocabScore: number; vocabTotal: number; quizScore: number; quizTotal: number }> {
  // Load all vocab and quizzes for this chapter
  const vocab = await db.select().from(vocabularyTable).where(eq(vocabularyTable.chapterId, chapterId));
  const quizzes = await db.select().from(quizzesTable).where(eq(quizzesTable.chapterId, chapterId));

  const vocabMap = new Map(vocab.map((v) => [v.id, v]));
  const quizMap = new Map(quizzes.map((q) => [q.id, q]));

  const details: AnswerDetail[] = [];
  let vocabScore = 0;
  let vocabTotal = 0;
  let quizScore = 0;
  let quizTotal = 0;

  for (const ans of answers) {
    const isVocab = ans.questionType.startsWith("vocab_");
    const isQuiz = ans.questionType.startsWith("comprehension_");

    if (isVocab) {
      vocabTotal++;
      const vocabItem = vocabMap.get(ans.questionId);
      if (!vocabItem) continue;

      let correctAnswer: string;
      let question: string;

      switch (ans.questionType) {
        case "vocab_en_to_ko":
          question = vocabItem.word;
          correctAnswer = vocabItem.meaning;
          break;
        case "vocab_ko_to_en":
          question = vocabItem.meaning;
          correctAnswer = vocabItem.word;
          break;
        case "vocab_multiple_choice":
          // For multiple choice, the answer is the correct meaning
          question = `${vocabItem.word}: Select the correct meaning`;
          correctAnswer = vocabItem.meaning;
          break;
        case "vocab_fill_blank":
          question = vocabItem.exampleSentence
            ? vocabItem.exampleSentence.replace(new RegExp(vocabItem.word, "gi"), "_____")
            : vocabItem.word;
          correctAnswer = vocabItem.word;
          break;
        default:
          question = vocabItem.word;
          correctAnswer = vocabItem.meaning;
      }

      const isCorrect = normalize(ans.answer) === normalize(correctAnswer);
      if (isCorrect) vocabScore++;

      details.push({
        questionId: ans.questionId,
        questionType: ans.questionType,
        question,
        studentAnswer: ans.answer,
        correctAnswer,
        isCorrect,
        explanation: vocabItem.exampleSentence ?? null,
      });
    } else if (isQuiz) {
      quizTotal++;
      const quizItem = quizMap.get(ans.questionId);
      if (!quizItem) continue;

      const isCorrect = normalize(ans.answer) === normalize(quizItem.answer);
      if (isCorrect) quizScore++;

      details.push({
        questionId: ans.questionId,
        questionType: ans.questionType,
        question: quizItem.question,
        studentAnswer: ans.answer,
        correctAnswer: quizItem.answer,
        isCorrect,
        explanation: quizItem.explanation ?? null,
      });
    }
  }

  return { details, vocabScore, vocabTotal, quizScore, quizTotal };
}

// ── Routes ─────────────────────────────────────────────────────────────────

/** GET /api/submissions — list all submissions (teacher view) */
router.get("/submissions", async (req, res) => {
  const subs = await db
    .select()
    .from(submissionsTable)
    .orderBy(desc(submissionsTable.submittedAt));

  res.json(
    subs.map((s) => ({
      ...s,
      answers: (s.answers as object[] | null) ?? null,
      submittedAt: s.submittedAt.toISOString(),
    }))
  );
});

/** POST /api/submissions — submit a student's quiz attempt */
router.post("/submissions", async (req, res) => {
  const body = CreateSubmissionBody.parse(req.body);
  const { studentName, chapterId, answers } = body;

  // Look up chapter + book info
  const [chapter] = await db
    .select({ chapter: chaptersTable, book: booksTable })
    .from(chaptersTable)
    .innerJoin(booksTable, eq(chaptersTable.bookId, booksTable.id))
    .where(eq(chaptersTable.id, chapterId));

  if (!chapter) {
    res.status(404).json({ error: "Chapter not found" }); return;
  }

  const { details, vocabScore, vocabTotal, quizScore, quizTotal } = await scoreSubmission(
    chapterId,
    answers as AnswerInput[]
  );

  const totalScore = vocabScore + quizScore;
  const totalPossible = vocabTotal + quizTotal;

  const [submission] = await db
    .insert(submissionsTable)
    .values({
      studentName,
      bookId: chapter.book.id,
      bookTitle: chapter.book.title,
      chapterId,
      chapterTitle: chapter.chapter.title,
      vocabScore,
      vocabTotal,
      quizScore,
      quizTotal,
      totalScore,
      totalPossible,
      answers: details as object[],
    })
    .returning();

  res.status(201).json({
    ...submission,
    answers: (submission.answers as object[] | null) ?? null,
    submittedAt: submission.submittedAt.toISOString(),
  });
});

/** GET /api/submissions/:submissionId — get a single submission */
router.get("/submissions/:submissionId", async (req, res) => {
  const { submissionId } = GetSubmissionParams.parse({ submissionId: Number(req.params.submissionId) });
  const [sub] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, submissionId));
  if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
  res.json({
    ...sub,
    answers: (sub.answers as object[] | null) ?? null,
    submittedAt: sub.submittedAt.toISOString(),
  });
});

export default router;
