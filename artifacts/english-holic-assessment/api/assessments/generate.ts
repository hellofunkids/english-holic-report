import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import formidable from "formidable";
import OpenAI from "openai";
import heicConvert from "heic-convert";
import { z } from "zod";
import { buildAssessmentReportPdf, type AssessmentReport } from "../_pdfBuilderAssessment";
import { withDb, sendJson } from "../_db";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

type SupportedMediaType = "image/jpeg" | "image/png" | "image/webp";

async function normalizeImage(buf: Buffer, originalname: string, mimetype: string): Promise<{ base64: string; mediaType: SupportedMediaType }> {
  const name = originalname.toLowerCase();
  const mime = mimetype.toLowerCase();
  const isHeic = name.endsWith(".heic") || name.endsWith(".heif") || mime.includes("heic") || mime.includes("heif");

  if (isHeic) {
    const jpegArrayBuffer = await heicConvert({
      buffer: buf as unknown as ArrayBufferLike,
      format: "JPEG",
      quality: 0.85,
    });
    return { base64: Buffer.from(jpegArrayBuffer).toString("base64"), mediaType: "image/jpeg" };
  }

  let mediaType: SupportedMediaType = "image/jpeg";
  if (mime.includes("png") || name.endsWith(".png")) mediaType = "image/png";
  else if (mime.includes("webp") || name.endsWith(".webp")) mediaType = "image/webp";

  return { base64: buf.toString("base64"), mediaType };
}

function capMeta(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, {
      error: "AI 서비스가 설정되지 않았습니다. Vercel 환경변수 OPENAI_API_KEY를 확인해 주세요.",
    });
    return;
  }

  let fields: formidable.Fields;
  let files: formidable.Files;
  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024, maxFiles: 8, keepExtensions: true });
    [fields, files] = await form.parse(req as Readable & IncomingMessage);
  } catch {
    sendJson(res, 400, { error: "파일 업로드 파싱 실패. 다시 시도해 주세요." });
    return;
  }

  const studentName = capMeta((fields.studentName?.[0] ?? "").trim(), 20);
  const teacherName = capMeta((fields.teacherName?.[0] ?? "").trim(), 20);
  const testTitle = capMeta(((fields.testTitle?.[0] ?? "") || (fields.bookName?.[0] ?? "") || "영어홀릭").trim(), 40);
  const imageFiles = (files.images ?? []) as formidable.File[];

  if (!studentName) { sendJson(res, 400, { error: "학생 이름을 입력해 주세요." }); return; }
  if (!teacherName) { sendJson(res, 400, { error: "담당 선생님을 선택해 주세요." }); return; }
  if (imageFiles.length === 0) { sendJson(res, 400, { error: "시험지 사진을 1장 이상 업로드해 주세요." }); return; }

  let images: { base64: string; mediaType: SupportedMediaType }[];
  try {
    const fs = await import("node:fs");
    images = await Promise.all(
      imageFiles.map(async (f) => {
        const buf = await fs.promises.readFile(f.filepath);
        return normalizeImage(buf, f.originalFilename ?? "", f.mimetype ?? "image/jpeg");
      }),
    );
  } catch {
    sendJson(res, 400, { error: "이미지 변환 실패. HEIC/JPG/PNG 파일만 업로드해 주세요." });
    return;
  }

  const prompt = `당신은 한국 영어학원의 베테랑 영어 선생님입니다. 학생이 푼 "영어홀릭" 논술 어취브먼트 테스트지(영작 위주의 평가지)를 사진으로 받았습니다. 채점하고 학부모에게 보낼 평가서를 작성해 주세요.

학생 이름: ${studentName}
교재: ${testTitle}

업로드된 ${images.length}장의 사진은 같은 학생의 같은 시험지 페이지들입니다. 모든 사진을 종합해서 분석해 주세요.

다음 항목을 포함한 JSON으로만 응답하세요:

{
  "overallComment": "총평 (3-4문장, 학부모가 읽기 좋은 따뜻한 한국어, 220자 내외)",
  "strengths": ["잘한 점 정확히 3개 (각 항목 1문장, 70자 내외, 구체적 근거 포함)"],
  "improvements": ["보완할 점 정확히 3개 (각 항목 1문장, 70자 내외, 구체적 실수 패턴 포함)"],
  "nextSteps": ["학습 제안 정확히 4개 (각 항목 1문장, 70자 내외, 실천 가능한 구체 행동)"],
  "domainScores": {
    "vocabulary": 0-100점 정수,
    "grammar": 0-100점 정수,
    "reading": 0-100점 정수,
    "writing": 0-100점 정수
  },
  "totalScore": 0-100 정수 (선택사항),
  "bestSentence": {
    "sentence": "학생이 작성한 가장 잘 쓴 영어 문장 한 개 (영어로)",
    "comment": "칭찬 (한국어 1-2문장, 70자 내외)"
  },
  "correctionExample": {
    "original": "학생이 실제로 쓴 잘못된 영어 문장 (영어로)",
    "corrected": "올바르게 고친 영어 문장 (영어로)",
    "reason": "설명 (한국어 1-2문장, 80자 내외)"
  },
  "parentMessage": "학부모님께 드리는 메시지 (4-5문장, 280자 내외)"
}

엄격한 규칙: strengths/improvements 정확히 3개, nextSteps 정확히 4개. JSON만 반환.`;

  let report: AssessmentReport;
  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: `data:${img.mediaType};base64,${img.base64}`, detail: "high" as const },
            })),
            { type: "text" as const, text: prompt },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI did not return JSON");
    const raw = JSON.parse(jsonMatch[0]);
    const parsed = ReportSchema.safeParse(raw);
    if (!parsed.success) throw new Error("AI response failed validation");

    report = parsed.data;
    const cap = (s: string, max: number) => s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
    report.strengths = report.strengths.slice(0, 3).map((s) => cap(s, 110));
    report.improvements = report.improvements.slice(0, 3).map((s) => cap(s, 110));
    report.nextSteps = report.nextSteps.slice(0, 4).map((s) => cap(s, 110));
    report.overallComment = cap(report.overallComment, 280);
    if (report.bestSentence) {
      report.bestSentence.sentence = cap(report.bestSentence.sentence, 140);
      report.bestSentence.comment = cap(report.bestSentence.comment, 110);
    }
    if (report.correctionExample) {
      report.correctionExample.original = cap(report.correctionExample.original, 140);
      report.correctionExample.corrected = cap(report.correctionExample.corrected, 140);
      report.correctionExample.reason = cap(report.correctionExample.reason, 130);
    }
    if (report.parentMessage) report.parentMessage = cap(report.parentMessage, 360);
  } catch (err) {
    const msg = err instanceof Error && err.message.includes("OPENAI_API_KEY")
      ? err.message
      : "AI 분석 실패. 사진이 선명한지 확인 후 다시 시도해 주세요.";
    sendJson(res, 502, { error: msg });
    return;
  }

  let pdf: Buffer;
  try {
    pdf = await buildAssessmentReportPdf(report, {
      studentName,
      teacherName,
      testTitle,
      date: new Date().toLocaleDateString("ko-KR"),
    });
  } catch {
    sendJson(res, 500, { error: "PDF 생성 실패" });
    return;
  }

  let assessmentId: number | undefined;
  try {
    assessmentId = await withDb(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO assessments (student_name, teacher_name, test_title, report)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [studentName, teacherName, testTitle, JSON.stringify(report)],
      );
      return rows[0]?.id as number | undefined;
    });
  } catch {
    // non-fatal: PDF already generated; continue without archive entry
  }

  sendJson(res, 200, { id: assessmentId, pdfBase64: pdf.toString("base64"), report });
}
