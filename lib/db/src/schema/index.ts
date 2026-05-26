import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Books ──────────────────────────────────────────────────────────────────
export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({ id: true, createdAt: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;

// ── Chapters ───────────────────────────────────────────────────────────────
export const chaptersTable = pgTable("chapters", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => booksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChapterSchema = createInsertSchema(chaptersTable).omit({ id: true, createdAt: true });
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chaptersTable.$inferSelect;

// ── Vocabulary ─────────────────────────────────────────────────────────────
export const vocabularyTable = pgTable("vocabulary", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapter_id").notNull().references(() => chaptersTable.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  meaning: text("meaning").notNull(),
  exampleSentence: text("example_sentence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVocabSchema = createInsertSchema(vocabularyTable).omit({ id: true, createdAt: true });
export type InsertVocab = z.infer<typeof insertVocabSchema>;
export type VocabItem = typeof vocabularyTable.$inferSelect;

// ── Quizzes ────────────────────────────────────────────────────────────────
export const quizzesTable = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapter_id").notNull().references(() => chaptersTable.id, { onDelete: "cascade" }),
  questionType: text("question_type").notNull(), // multiple_choice | short_answer
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>(), // for multiple_choice
  answer: text("answer").notNull(),
  explanation: text("explanation"),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQuizSchema = createInsertSchema(quizzesTable).omit({ id: true, createdAt: true });
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzesTable.$inferSelect;

// ── Submissions ────────────────────────────────────────────────────────────
// answers is a JSON array of AnswerDetail objects
export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  studentName: text("student_name").notNull(),
  bookId: integer("book_id").notNull(),
  bookTitle: text("book_title").notNull(),
  chapterId: integer("chapter_id").notNull(),
  chapterTitle: text("chapter_title").notNull(),
  vocabScore: integer("vocab_score").default(0).notNull(),
  vocabTotal: integer("vocab_total").default(0).notNull(),
  quizScore: integer("quiz_score").default(0).notNull(),
  quizTotal: integer("quiz_total").default(0).notNull(),
  totalScore: integer("total_score").default(0).notNull(),
  totalPossible: integer("total_possible").default(0).notNull(),
  answers: jsonb("answers").$type<object[]>(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({ id: true, submittedAt: true });
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissionsTable.$inferSelect;
