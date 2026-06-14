import type { IncomingMessage, ServerResponse } from "node:http";
import { withDb, sendJson } from "../../_db";
import { buildAssessmentReportPdf, type AssessmentReport } from "../../_pdfBuilderAssessment";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST") { sendJson(res, 405, { error: "Method not allowed" }); return; }

  const parts = (req.url ?? "").split("?")[0].split("/").filter(Boolean);
  const idStr = parts[parts.length - 2];
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    sendJson(res, 400, { error: "잘못된 ID입니다." });
    return;
  }

  let row: { student_name: string; teacher_name: string; test_title: string; report: AssessmentReport; created_at: string } | null = null;
  try {
    row = await withDb(async (client) => {
      const { rows } = await client.query(
        "SELECT student_name, teacher_name, test_title, report, created_at FROM assessments WHERE id = $1 LIMIT 1",
        [id],
      );
      return (rows[0] ?? null) as typeof row;
    });
  } catch (err) {
    sendJson(res, 500, { error: "DB 오류" });
    return;
  }

  if (!row) { sendJson(res, 404, { error: "평가서를 찾을 수 없습니다." }); return; }

  try {
    const pdf = await buildAssessmentReportPdf(row.report, {
      studentName: row.student_name,
      teacherName: row.teacher_name,
      testTitle: row.test_title,
      date: new Date(row.created_at).toLocaleDateString("ko-KR"),
    });
    sendJson(res, 200, { pdfBase64: pdf.toString("base64") });
  } catch {
    sendJson(res, 500, { error: "PDF 재생성 실패" });
  }
}
