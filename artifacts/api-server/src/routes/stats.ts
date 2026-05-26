import { Router } from "express";
import { db, submissionsTable, booksTable } from "@workspace/db";
import { desc, sql, count } from "drizzle-orm";

const router = Router();

/** GET /api/stats/summary — overall stats for teacher dashboard */
router.get("/stats/summary", async (req, res) => {
  // Total submissions
  const [{ total }] = await db
    .select({ total: count() })
    .from(submissionsTable);

  // Distinct students
  const [{ students }] = await db
    .select({ students: sql<number>`count(distinct ${submissionsTable.studentName})` })
    .from(submissionsTable);

  // Total books
  const [{ books }] = await db
    .select({ books: count() })
    .from(booksTable);

  // Average score percentage
  const [{ avg }] = await db
    .select({
      avg: sql<number>`
        CASE
          WHEN SUM(${submissionsTable.totalPossible}) = 0 THEN 0
          ELSE ROUND(
            (SUM(${submissionsTable.totalScore})::numeric /
             NULLIF(SUM(${submissionsTable.totalPossible}), 0)) * 100, 1
          )
        END
      `,
    })
    .from(submissionsTable);

  // Recent 5 submissions
  const recentSubs = await db
    .select()
    .from(submissionsTable)
    .orderBy(desc(submissionsTable.submittedAt))
    .limit(5);

  res.json({
    totalSubmissions: Number(total),
    totalStudents: Number(students),
    totalBooks: Number(books),
    averageScore: Number(avg ?? 0),
    recentSubmissions: recentSubs.map((s) => ({
      ...s,
      answers: null, // omit answers in summary for performance
      submittedAt: s.submittedAt.toISOString(),
    })),
  });
});

/** GET /api/stats/leaderboard — top scoring students */
router.get("/stats/leaderboard", async (req, res) => {
  const rows = await db
    .select({
      studentName: submissionsTable.studentName,
      submissionCount: count(),
      avgScore: sql<number>`
        ROUND(
          (SUM(${submissionsTable.totalScore})::numeric /
           NULLIF(SUM(${submissionsTable.totalPossible}), 0)) * 100, 1
        )
      `,
      bestScore: sql<number>`
        MAX(
          CASE
            WHEN ${submissionsTable.totalPossible} > 0
            THEN ROUND((${submissionsTable.totalScore}::numeric / ${submissionsTable.totalPossible}) * 100)
            ELSE 0
          END
        )
      `,
    })
    .from(submissionsTable)
    .groupBy(submissionsTable.studentName)
    .orderBy(sql`ROUND((SUM(${submissionsTable.totalScore})::numeric / NULLIF(SUM(${submissionsTable.totalPossible}), 0)) * 100, 1) DESC NULLS LAST`)
    .limit(10);

  res.json(
    rows.map((r) => ({
      studentName: r.studentName,
      averageScore: Number(r.avgScore ?? 0),
      submissionCount: Number(r.submissionCount),
      bestScore: Number(r.bestScore ?? 0),
    }))
  );
});

export default router;
