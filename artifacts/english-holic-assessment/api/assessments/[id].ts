import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { withDb, sendJson } from "../_db";
import { buildAssessmentReportPdf } from "../_pdfBuilderAssessment";

const ReportSchema = z.object({
  overallComment: z.string().min(1),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  nextSteps: z.array(z.string()).min(1),
  domainScores: z.object({
    vocabulary: z.number().min(0).max(100),
    grammar: z.number().min(0).max(100),
    reading: z.number().min(0).max(100),
    writing: z.number().min(0).max(100),
  }),
  totalScore: z.number().min(0).max(100).optional(),
  bestSentence: z.object({ sentence: z.string().min(1), comment: z.string().min(1) }).optional(),
  correctionExample: z.object({ original: z.string().min(1), corrected: z.string().min(1), reason: z.string().min(1) }).optional(),
  parentMessage: z.string().optional(),
});

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const parts = (req.url ?? "").split("?")[0].split("/").filter(Boolean);
  const idStr = parts[parts.length - 1];
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    sendJson(res, 400, { error: "잘못된 ID입니다." });
    return;
  }

  if (req.method === "DELETE") {
    try {
      await withDb((client) =>
        client.query("DELETE FROM assessments WHERE id = $1", [id]),
      );
      sendJson(res, 200, { ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DB 오류";
      sendJson(res, 500, { error: msg });
    }
    return;
  }

  if (req.method === "PATCH") {
    let bodyText: string;
    try {
      bodyText = await readBody(req);
    } catch {
      sendJson(res, 400, { error: "요청 본문을 읽을 수 없습니다." });
      return;
    }

    let parsed;
    try {
      parsed = ReportSchema.safeParse(JSON.parse(bodyText));
    } catch {
      sendJson(res, 400, { error: "잘못된 JSON 형식입니다." });
      return;
    }

    if (!parsed.success) {
      sendJson(res, 400, { error: "잘못된 평가서 데이터입니다." });
      return;
    }

    const report = parsed.data;

    let row: { student_name: string; teacher_name: string; test_title: string; created_at: string } | null = null;
    try {
      row = await withDb(async (client) => {
        await client.query(
          "UPDATE assessments SET report = $1 WHERE id = $2",
          [JSON.stringify(report), id],
        );
        const { rows } = await client.query(
          "SELECT student_name, teacher_name, test_title, created_at FROM assessments WHERE id = $1 LIMIT 1",
          [id],
        );
        return (rows[0] ?? null) as typeof row;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DB 오류";
      sendJson(res, 500, { error: msg });
      return;
    }

    if (!row) {
      sendJson(res, 404, { error: "평가서를 찾을 수 없습니다." });
      return;
    }

    try {
      const pdf = await buildAssessmentReportPdf(report, {
        studentName: row.student_name,
        teacherName: row.teacher_name,
        testTitle: row.test_title,
        date: new Date(row.created_at).toLocaleDateString("ko-KR"),
      });
      sendJson(res, 200, { pdfBase64: pdf.toString("base64"), report });
    } catch {
      sendJson(res, 500, { error: "PDF 재생성 실패" });
    }
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
