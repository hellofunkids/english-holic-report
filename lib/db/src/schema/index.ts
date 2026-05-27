import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Books ──────────────────────────────────────────────────────────────────
export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({ id: true, createdAt: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;

// ── Embedded JSON types ────────────────────────────────────────────────────
export type VocabEntry = {
  word: string;
  pronunciation: string;
  meaning: string;
  example: string;
};

export type VocabQuestion = {
  number: number;
  type: "fill_blank" | "match_meaning" | "choose_word" | "spelling";
  question: string;
  options?: string[];
  answer: string;
};

export type ReadingQuestion = {
  number: number;
  question: string;
  options: string[];
  answer: string;
};

// ── Materials ─────────────────────────────────────────────────────────────
export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => booksTable.id, { onDelete: "cascade" }),
  bookTitle: text("book_title").notNull(),
  chapterTitle: text("chapter_title").notNull(),
  level: text("level").notNull().default("elementary4"),
  author: text("author"),
  vocabulary: jsonb("vocabulary").$type<VocabEntry[]>().notNull(),
  vocabQuestions: jsonb("vocab_questions").$type<VocabQuestion[]>().notNull(),
  readingQuestions: jsonb("reading_questions").$type<ReadingQuestion[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Material = typeof materialsTable.$inferSelect;

// ── Assessments (영어홀릭 평가서) ────────────────────────────────────────
export type AssessmentReportJson = {
  overallComment: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  domainScores: {
    vocabulary: number;
    grammar: number;
    reading: number;
    writing: number;
  };
  totalScore?: number;
  bestSentence?: { sentence: string; comment: string };
  correctionExample?: { original: string; corrected: string; reason: string };
  parentMessage?: string;
};

export const assessmentsTable = pgTable("assessments", {
  id: serial("id").primaryKey(),
  studentName: text("student_name").notNull(),
  teacherName: text("teacher_name").notNull(),
  testTitle: text("test_title").notNull(),
  report: jsonb("report").$type<AssessmentReportJson>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Assessment = typeof assessmentsTable.$inferSelect;
