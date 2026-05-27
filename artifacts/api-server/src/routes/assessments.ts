import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import heicConvert from "heic-convert";
import { z } from "zod/v4";
import {
  buildAssessmentReportPdf,
  type AssessmentReport,
} from "../lib/pdfBuilderAssessment";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 8 },
});

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

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
});

async function normalizeImage(file: Express.Multer.File): Promise<{
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
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

  let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" =
    "image/jpeg";
  if (mime.includes("png") || name.endsWith(".png")) mediaType = "image/png";
  else if (mime.includes("webp") || name.endsWith(".webp"))
    mediaType = "image/webp";
  else if (mime.includes("gif") || name.endsWith(".gif"))
    mediaType = "image/gif";

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
    const studentName: string =
      typeof req.body?.studentName === "string"
        ? req.body.studentName.trim()
        : "";
    const teacherName: string =
      typeof req.body?.teacherName === "string"
        ? req.body.teacherName.trim()
        : "";
    const testTitle: string =
      typeof req.body?.testTitle === "string" && req.body.testTitle.trim()
        ? req.body.testTitle.trim()
        : "영어홀릭";
    const bookName: string =
      typeof req.body?.bookName === "string" && req.body.bookName.trim()
        ? req.body.bookName.trim()
        : testTitle;

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
  "overallComment": "학생의 전반적인 영어 실력과 이번 시험 결과에 대한 따뜻하면서도 솔직한 총평 (4-6문장, 학부모가 읽기 좋은 한국어)",
  "strengths": ["잘한 점 3-4개, 구체적인 문항이나 표현을 근거로 (한국어, 각 1-2문장)"],
  "improvements": ["보완이 필요한 점 3-4개, 구체적인 실수 패턴과 함께 (한국어, 각 1-2문장)"],
  "nextSteps": ["가정학습/학원학습에서 다음으로 집중할 학습 제안 3-4개 (한국어, 각 1-2문장)"],
  "domainScores": {
    "vocabulary": 0-100점 정수 (어휘 사용의 정확성과 다양성),
    "grammar": 0-100점 정수 (문법 정확도),
    "reading": 0-100점 정수 (지문/문제 이해도),
    "writing": 0-100점 정수 (영작 표현력과 구성)
  },
  "totalScore": 0-100 정수 (선택사항, 시험지에 총점이 있으면 그 점수)
}

규칙:
- 모든 텍스트는 한국어로 작성 (영어 단어/문장은 인용할 때만)
- 코멘트는 학부모가 이해하기 쉽고 따뜻한 톤
- 평가서는 2페이지로 출력될 예정이니, 각 항목은 핵심만 간결하게 작성
- JSON만 반환, 다른 텍스트 없이`;

    let report: AssessmentReport;
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
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

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI did not return JSON");
      const raw = JSON.parse(jsonMatch[0]);
      const parsed = ReportSchema.safeParse(raw);
      if (!parsed.success) {
        req.log.error({ issues: parsed.error.issues, raw }, "Report validation failed");
        throw new Error("AI response failed validation");
      }
      report = parsed.data;
    } catch (err) {
      req.log.error({ err }, "AI assessment generation failed");
      res
        .status(502)
        .json({ error: "AI 분석 실패. 사진이 선명한지 확인 후 다시 시도해 주세요." });
      return;
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
      pdfBase64: pdf.toString("base64"),
      report,
    });
  },
);

export default router;
