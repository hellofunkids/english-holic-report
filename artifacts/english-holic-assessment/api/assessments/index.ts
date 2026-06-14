import type { IncomingMessage, ServerResponse } from "node:http";
import { withDb, sendJson } from "../_db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "GET") { sendJson(res, 405, { error: "Method not allowed" }); return; }

  try {
    const list = await withDb(async (client) => {
      const { rows } = await client.query(
        `SELECT id, student_name, teacher_name, test_title, report, created_at
         FROM assessments ORDER BY created_at DESC LIMIT 500`,
      );
      return rows.map((r) => ({
        id: r.id as number,
        studentName: r.student_name as string,
        teacherName: r.teacher_name as string,
        testTitle: r.test_title as string,
        createdAt: r.created_at as string,
        totalScore:
          r.report && typeof r.report === "object" && "totalScore" in r.report
            ? (r.report as { totalScore?: number }).totalScore
            : undefined,
      }));
    });
    sendJson(res, 200, list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB 오류";
    sendJson(res, 500, { error: msg });
  }
}
