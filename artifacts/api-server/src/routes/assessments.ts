import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import heicConvert from "heic-convert";
import { z } from "zod/v4";
import { db, assessmentsTable } from "@workspace/db";
import { eq, desc, ilike } from "drizzle-orm";
import {
  buildAssessmentReportPdf,
  type AssessmentReport,
} from "../lib/pdfBuilderAssessment";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 8 },
});

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) {
    throw new Error("AI_INTEGRATIONS_ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  return new Anthropic({ apiKey, ...(baseURL ? { baseURL } : {}) });
}

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
  bestSentence: z
    .object({
      sentence: z.string().min(1),
      comment: z.string().min(1),
    })
    .optional(),
  correctionExample: z
    .object({
      original: z.string().min(1),
      corrected: z.string().min(1),
      reason: z.string().min(1),
    })
    .optional(),
  parentMessage: z.string().optional(),
});

type SupportedMediaType = "image/jpeg" | "image/png" | "image/webp";

async function normalizeImage(file: Express.Multer.File): Promise<{
  base64: string;
  mediaType: SupportedMediaType;
}> {
  const name = file.originalname.toLowerCase();
  const mime = file.mimetype.toLowerCase();
  const isHeic =
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    mime.includes("heic") ||
    mime.includes("heif");

  if (isHeic) {
    const jpegArrayBuffer = await heicConvert({
      buffer: file.buffer as unknown as ArrayBufferLike,
      format: "JPEG",
      quality: 0.85,
    });
    return {
      base64: Buffer.from(jpegArrayBuffer).toString("base64"),
      mediaType: "image/jpeg",
    };
  }

  let mediaType: SupportedMediaType = "image/jpeg";
  if (mime.includes("png") || name.endsWith(".png")) mediaType = "image/png";
  else if (mime.includes("webp") || name.endsWith(".webp")) mediaType = "image/webp";

  return {
    base64: file.buffer.toString("base64"),
    mediaType,
  };
}

router.post(
  "/assessments/generate",
  upload.array("images", 8),
  async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const capMeta = (s: string, max: number) =>
      s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
    const studentName: string = capMeta(
      typeof req.body?.studentName === "string"
        ? req.body.studentName.trim()
        : "",
      20,
    );
    const teacherName: string = capMeta(
      typeof req.body?.teacherName === "string"
        ? req.body.teacherName.trim()
        : "",
      20,
    );
    const testTitle: string = capMeta(
      typeof req.body?.testTitle === "string" && req.body.testTitle.trim()
        ? req.body.testTitle.trim()
        : "영어홀릭",
      40,
    );
    const bookName: string = capMeta(
      typeof req.body?.bookName === "string" && req.body.bookName.trim()
        ? req.body.bookName.trim()
        : testTitle,
      40,
    );

    if (!studentName) {
      res.status(400).json({ error: "학생 이름을 입력해 주세요." });
      return;
    }
    if (!teacherName) {
      res.status(400).json({ error: "담당 선생님을 선택해 주세요." });
      return;
    }
    if (files.length === 0) {
      res.status(400).json({ error: "시험지 사진을 1장 이상 업로드해 주세요." });
      return;
    }

    // Check API key early for a clear error message
    if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
      req.log.error("AI_INTEGRATIONS_ANTHROPIC_API_KEY is not set");
      res.status(503).json({
        error: "AI 서비스가 설정되지 않았습니다. AI_INTEGRATIONS_ANTHROPIC_API_KEY 환경변수를 확인해 주세요.",
      });
      return;
    }

    req.log.info(
      { studentName, teacherName, fileCount: files.length },
      "Generating assessment report",
    );

    let images: Awaited<ReturnType<typeof normalizeImage>>[];
    try {
      images = await Promise.all(files.map(normalizeImage));
    } catch (err) {
      req.log.error({ err }, "Image normalization failed");
      res
        .status(400)
        .json({ error: "이미지 변환 실패. HEIC/JPG/PNG 파일만 업로드해 주세요." });
      return;
    }

    const prompt = `당신은 한국 영어학원의 베테랑 영어 선생님입니다. 학생이 푼 "영어홀릭" 논술 어취브먼트 테스트지(영작 위주의 평가지)를 사진으로 받았습니다. 채점하고 학부모에게 보낼 평가서를 작성해 주세요.

학생 이름: ${studentName}
교재: ${bookName}

업로드된 ${images.length}장의 사진은 같은 학생의 같은 시험지 페이지들입니다. 모든 사진을 종합해서 분석해 주세요.

다음 항목을 포함한 JSON으로만 응답하세요:

{
  "overallComment": "총평 (3-4문장, 학부모가 읽기 좋은 따뜻한 한국어, 220자 내외)",
  "strengths": ["잘한 점 정확히 3개 (각 항목 1문장, 70자 내외, 구체적 근거 포함)"],
  "improvements": ["보완할 점 정확히 3개 (각 항목 1문장, 70자 내외, 구체적 실수 패턴 포함)"],
  "nextSteps": ["학습 제안 정확히 4개 (각 항목 1문장, 70자 내외, 실천 가능한 구체 행동)"],
  "domainScores": {
    "vocabulary": 0-100점 정수 (어휘 사용의 정확성과 다양성),
    "grammar": 0-100점 정수 (문법 정확도),
    "reading": 0-100점 정수 (지문/문제 이해도),
    "writing": 0-100점 정수 (영작 표현력과 구성)
  },
  "totalScore": 0-100 정수 (선택사항, 시험지에 총점이 있으면 그 점수),
  "bestSentence": {
    "sentence": "학생이 작성한 답안 중 가장 잘 쓴 영어 문장 한 개 (시험지에서 그대로 인용, 영어로)",
    "comment": "왜 이 문장이 잘 쓰여졌는지 칭찬 (한국어 1-2문장, 70자 내외)"
  },
  "correctionExample": {
    "original": "학생이 실제로 쓴 잘못된 영어 문장 한 개 (시험지에서 그대로 인용, 영어로)",
    "corrected": "올바르게 고친 영어 문장 (영어로)",
    "reason": "왜 틀렸고 어떻게 고쳤는지 설명 (한국어 1-2문장, 80자 내외)"
  },
  "parentMessage": "학부모님께 드리는 따뜻한 격려와 학습 방향 안내 메시지 (4-5문장, 280자 내외, 학원 선생님이 학부모에게 직접 건네는 톤)"
}

엄격한 규칙 (반드시 준수):
- 평가서는 **A4 양면 1장 (총 2페이지)** 에 딱 맞춰 인쇄됩니다.
- strengths / improvements는 **정확히 3개씩**, nextSteps는 **정확히 4개**.
- 각 항목 글자 수는 위에 명시된 범위를 지킬 것.
- bestSentence와 correctionExample은 **반드시 시험지에서 학생이 실제로 쓴 문장을 인용**할 것. 만들어내지 말 것.
- parentMessage는 학부모에게 직접 말하는 따뜻한 톤 ("어머님/아버님, ...학생이..." 식).
- 모든 한글 텍스트는 한국어. 영어 문장(bestSentence/correctionExample)은 영어 그대로.
- JSON만 반환, 다른 텍스트 없이.`;

    let report: AssessmentReport;
    try {
      const anthropic = getAnthropicClient();
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              ...images.map((img) => ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: img.mediaType,
                  data: img.base64,
                },
              })),
              { type: "text" as const, text: prompt },
            ],
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI did not return JSON");
      const raw = JSON.parse(jsonMatch[0]);
      const parsed = ReportSchema.safeParse(raw);
      if (!parsed.success) {
        req.log.error({ issues: parsed.error.issues, raw }, "Report validation failed");
        throw new Error("AI response failed validation");
      }
      report = parsed.data;
      // Enforce hard caps so PDF fits in 2 pages even if AI ignored prompt
      const cap = (s: string, max: number) =>
        s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
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
      if (report.parentMessage) {
        report.parentMessage = cap(report.parentMessage, 360);
      }
    } catch (err) {
      req.log.error({ err }, "AI assessment generation failed");
      const msg =
        err instanceof Error && err.message.includes("API_KEY")
          ? err.message
          : "AI 분석 실패. 사진이 선명한지 확인 후 다시 시도해 주세요.";
      res.status(502).json({ error: msg });
      return;
    }

    // Persist to DB so it can be listed/searched later
    let assessmentId: number | undefined;
    try {
      const [row] = await db
        .insert(assessmentsTable)
        .values({
          studentName,
          teacherName,
          testTitle: bookName,
          report,
        })
        .returning({ id: assessmentsTable.id });
      assessmentId = row?.id;
    } catch (err) {
      req.log.error({ err }, "Failed to persist assessment");
      // continue — PDF generation still proceeds
    }

    let pdf: Buffer;
    try {
      pdf = await buildAssessmentReportPdf(report, {
        studentName,
        teacherName,
        testTitle: bookName,
        date: new Date().toLocaleDateString("ko-KR"),
      });
    } catch (err) {
      req.log.error({ err }, "Assessment PDF build failed");
      res.status(500).json({ error: "PDF 생성 실패" });
      return;
    }

    res.status(200).json({
      id: assessmentId,
      pdfBase64: pdf.toString("base64"),
      report,
    });
  },
);

/** GET /assessments — list (optional ?q= search by student name) */
router.get("/assessments", async (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const rows = await db
    .select({
      id: assessmentsTable.id,
      studentName: assessmentsTable.studentName,
      teacherName: assessmentsTable.teacherName,
      testTitle: assessmentsTable.testTitle,
      createdAt: assessmentsTable.createdAt,
      totalScore: assessmentsTable.report,
    })
    .from(assessmentsTable)
    .where(q ? ilike(assessmentsTable.studentName, `%${q}%`) : undefined)
    .orderBy(desc(assessmentsTable.createdAt))
    .limit(500);

  const list = rows.map((r) => ({
    id: r.id,
    studentName: r.studentName,
    teacherName: r.teacherName,
    testTitle: r.testTitle,
    createdAt: r.createdAt,
    totalScore:
      r.totalScore && typeof r.totalScore === "object" && "totalScore" in r.totalScore
        ? (r.totalScore as { totalScore?: number }).totalScore
        : undefined,
  }));
  res.json(list);
});

/** POST /assessments/:id/pdf — regenerate PDF from stored report (no AI) */
router.post("/assessments/:id/pdf", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "잘못된 ID입니다." });
    return;
  }
  const [row] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "평가서를 찾을 수 없습니다." });
    return;
  }
  try {
    const pdf = await buildAssessmentReportPdf(row.report as AssessmentReport, {
      studentName: row.studentName,
      teacherName: row.teacherName,
      testTitle: row.testTitle,
      date: new Date(row.createdAt).toLocaleDateString("ko-KR"),
    });
    res.json({
      pdfBase64: pdf.toString("base64"),
      studentName: row.studentName,
      teacherName: row.teacherName,
      testTitle: row.testTitle,
      createdAt: row.createdAt,
      report: row.report,
    });
  } catch (err) {
    req.log.error({ err, id }, "Assessment PDF regeneration failed");
    res.status(500).json({ error: "PDF 재생성 실패" });
  }
});

/** DELETE /assessments/:id */
router.delete("/assessments/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "잘못된 ID입니다." });
    return;
  }
  await db.delete(assessmentsTable).where(eq(assessmentsTable.id, id));
  res.json({ ok: true });
});

export default router;
