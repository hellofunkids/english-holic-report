import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const NAVY = "#1a2e5a";
const GOLD = "#c9a227";
const GOLD_SOFT = "#f7f3e8";
const GREEN = "#1a6b3a";
const GREEN_SOFT = "#e8f3ec";
const RED = "#c0392b";
const RED_SOFT = "#fbeceb";
const BLUE = "#2563a8";
const BLUE_SOFT = "#e6effa";
const GREY = "#3a3a3a";
const GRID = "#d8dbe5";

const ACADEMY_NAME = "헬로펀키즈 주니어 어학원";

const FONT_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/hellofunkids/english-holic-report@main/artifacts/api-server/src/assets/fonts";

const FONT_CACHE_DIR = "/tmp/noto-kr-fonts";

async function ensureFonts(): Promise<{ regular: string; bold: string }> {
  fs.mkdirSync(FONT_CACHE_DIR, { recursive: true });
  const regular = path.join(FONT_CACHE_DIR, "NotoSansKR-Regular.ttf");
  const bold = path.join(FONT_CACHE_DIR, "NotoSansKR-Bold.ttf");

  const download = async (filename: string, dest: string) => {
    if (fs.existsSync(dest)) return;
    const url = `${FONT_CDN_BASE}/${filename}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Font download failed (${res.status}): ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
  };

  // Try CDN first, fall back to local api-server fonts if available
  try {
    await Promise.all([
      download("NotoSansKR-Regular.ttf", regular),
      download("NotoSansKR-Bold.ttf", bold),
    ]);
  } catch {
    // Fall back to local paths (development / api-server environment)
    const HERE = (() => {
      try { return path.dirname(fileURLToPath(import.meta.url)); } catch { return __dirname ?? "."; }
    })();
    const localCandidates = [
      path.join(process.cwd(), "api", "fonts"),
      path.resolve(HERE, "../assets/fonts"),
      path.resolve(HERE, "./assets/fonts"),
    ];
    for (const dir of localCandidates) {
      const r = path.join(dir, "NotoSansKR-Regular.ttf");
      const b = path.join(dir, "NotoSansKR-Bold.ttf");
      if (fs.existsSync(r) && fs.existsSync(b)) {
        return { regular: r, bold: b };
      }
    }
    throw new Error("Korean fonts not found. Check CDN or local font paths.");
  }

  return { regular, bold };
}

const F_REG = "Body";
const F_BOLD = "Bold";

export interface AssessmentReport {
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
}

export interface AssessmentMeta {
  studentName: string;
  teacherName: string;
  testTitle: string;
  date: string;
}

const DOMAINS: Array<{ key: keyof AssessmentReport["domainScores"]; label: string }> = [
  { key: "vocabulary", label: "어휘" },
  { key: "grammar", label: "문법" },
  { key: "reading", label: "독해" },
  { key: "writing", label: "작문" },
];

export async function buildAssessmentReportPdf(
  report: AssessmentReport,
  meta: AssessmentMeta,
): Promise<Buffer> {
  const fonts = await ensureFonts();

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    doc.registerFont(F_REG, fonts.regular);
    doc.registerFont(F_BOLD, fonts.bold);
    doc.font(F_REG);
    const killBottomMargin = () => {
      doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    };
    killBottomMargin();
    doc.on("pageAdded", killBottomMargin);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const strengths = report.strengths.slice(0, 3);
    const improvements = report.improvements.slice(0, 3);
    const nextSteps = report.nextSteps.slice(0, 4);

    drawHeader(doc, meta);
    let y = 100;
    y = drawInfoCard(doc, meta, y);
    y += 14;

    y = drawSectionTitle(doc, "영역별 성취도 분석", y);
    y = drawRadarBlock(doc, report.domainScores, report.totalScore, y);
    y += 14;

    y = drawSectionTitle(doc, "원장님의 정밀 진단", y);
    drawDiagnosisCards(doc, strengths, improvements, y);

    doc.addPage();
    let y2 = 50;

    y2 = drawSectionTitle(doc, "문장 클리닉 (Best & Check)", y2);
    y2 = drawSentenceClinic(doc, report.bestSentence, report.correctionExample, y2);
    y2 += 14;

    y2 = drawSectionTitle(doc, "다음 학습 제안", y2);
    y2 = drawNextStepsList(doc, nextSteps, y2);
    y2 += 14;

    y2 = drawSectionTitle(doc, "학부모님께 드리는 메시지", y2);
    drawParentMessage(doc, report.parentMessage ?? report.overallComment, meta, y2);

    drawSignature(doc, meta);
    drawPageFooters(doc);

    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, meta: AssessmentMeta) {
  doc.rect(0, 0, doc.page.width, 70).fill(NAVY);
  doc.fillColor("white").fontSize(14).font(F_BOLD).text(ACADEMY_NAME, 40, 12, { lineBreak: false });
  doc.fillColor("#c9d4f0").fontSize(9.5).font(F_REG).text("학업 성취도 평가서 · Achievement Test Report", 40, 30, { lineBreak: false });
  doc.fillColor(GOLD).fontSize(11).font(F_BOLD).text(`교재: ${meta.testTitle}`, 40, 48, { width: doc.page.width - 240, lineBreak: false });
  doc.fillColor("white").fontSize(9).font(F_BOLD).text(`담당: ${meta.teacherName}`, doc.page.width - 200, 16, { width: 160, align: "right", lineBreak: false });
  doc.fillColor("#c9d4f0").fontSize(8.5).font(F_REG).text(meta.date, doc.page.width - 200, 32, { width: 160, align: "right", lineBreak: false });
}

function drawInfoCard(doc: PDFKit.PDFDocument, meta: AssessmentMeta, y: number): number {
  const x = 40, w = doc.page.width - 80, h = 36;
  doc.roundedRect(x, y, w, h, 6).fillAndStroke(GOLD_SOFT, GOLD);
  doc.fillColor("#6b5a1f").font(F_REG).fontSize(8.5).text("학생 이름", x + 14, y + 6, { lineBreak: false });
  doc.font(F_BOLD).fontSize(13).fillColor(NAVY).text(meta.studentName, x + 14, y + 17, { lineBreak: false });
  doc.font(F_REG).fontSize(8.5).fillColor("#6b5a1f").text("평가일", x + w - 180, y + 6, { lineBreak: false });
  doc.font(F_BOLD).fontSize(11).fillColor(NAVY).text(meta.date, x + w - 180, y + 18, { lineBreak: false });
  return y + h;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.rect(40, y + 2, 3, 12).fill(GOLD);
  doc.fillColor(NAVY).font(F_BOLD).fontSize(11.5).text(title, 50, y, { lineBreak: false });
  return y + 18;
}

function drawRadarBlock(doc: PDFKit.PDFDocument, scores: AssessmentReport["domainScores"], totalScore: number | undefined, y: number): number {
  const x = 40, w = doc.page.width - 80, h = 180;
  doc.roundedRect(x, y, w, h, 8).fillAndStroke("#fafbfd", "#e0e3ec");
  drawRadar(doc, scores, x + 105, y + h / 2, 62);
  const listX = x + 220, listW = w - 220 - 20;
  drawScoreList(doc, scores, listX, y + 18, listW);
  if (typeof totalScore === "number" && Number.isFinite(totalScore))
    drawTotalScoreBand(doc, listX, y + h - 36, listW, clamp(totalScore));
  return y + h;
}

function drawRadar(doc: PDFKit.PDFDocument, scores: AssessmentReport["domainScores"], cx: number, cy: number, radius: number) {
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  const values = [clamp(scores.vocabulary), clamp(scores.grammar), clamp(scores.reading), clamp(scores.writing)];
  for (const r of [0.33, 0.66, 1]) {
    const pts = angles.map((a) => [cx + Math.cos(a) * radius * r, cy + Math.sin(a) * radius * r] as [number, number]);
    polygonPath(doc, pts); doc.lineWidth(0.5).stroke(GRID);
  }
  for (const a of angles) doc.lineWidth(0.5).moveTo(cx, cy).lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius).stroke(GRID);
  const scorePts = angles.map((a, i) => [cx + Math.cos(a) * radius * (values[i] / 100), cy + Math.sin(a) * radius * (values[i] / 100)] as [number, number]);
  polygonPath(doc, scorePts); doc.fillOpacity(0.25).fill(NAVY); doc.fillOpacity(1);
  polygonPath(doc, scorePts); doc.lineWidth(1.2).stroke(NAVY);
  for (const [px, py] of scorePts) doc.circle(px, py, 2.5).fill(GOLD);
  const labels = ["어휘", "문법", "독해", "작문"];
  const positions: Array<[number, number, "center" | "left" | "right"]> = [
    [cx - 20, cy - radius - 16, "center"], [cx + radius + 6, cy - 5, "left"],
    [cx - 20, cy + radius + 6, "center"], [cx - radius - 46, cy - 5, "right"],
  ];
  doc.fillColor(NAVY).font(F_BOLD).fontSize(8.5);
  for (let i = 0; i < labels.length; i++) {
    const [lx, ly, align] = positions[i];
    doc.text(labels[i], lx, ly, { width: 40, align, lineBreak: false });
  }
}

function polygonPath(doc: PDFKit.PDFDocument, pts: Array<[number, number]>) {
  doc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
  doc.closePath();
}

function drawScoreList(doc: PDFKit.PDFDocument, scores: AssessmentReport["domainScores"], x: number, y: number, w: number) {
  const rowH = 22, badgeW = 92;
  for (let i = 0; i < DOMAINS.length; i++) {
    const d = DOMAINS[i], value = clamp(scores[d.key]), ry = y + i * rowH;
    doc.fillColor(NAVY).font(F_BOLD).fontSize(9.5).text(d.label, x, ry + 4, { width: 50, lineBreak: false });
    doc.fillColor(scoreColor(value)).font(F_BOLD).fontSize(12).text(`${value}점`, x + 52, ry + 2, { width: 36, align: "right", lineBreak: false });
    const barX = x + 96, barW = w - 96 - badgeW - 8;
    if (barW > 20) {
      doc.roundedRect(barX, ry + 6, barW, 8, 4).fill("#eceff5");
      doc.roundedRect(barX, ry + 6, Math.max(2, (barW * value) / 100), 8, 4).fill(scoreColor(value));
    }
    drawBadge(doc, x + w - badgeW, ry + 3, value, badgeW);
  }
}

function drawBadge(doc: PDFKit.PDFDocument, x: number, y: number, value: number, w: number = 38) {
  const label = scoreLabel(value), color = scoreColor(value), bgColor = scoreSoftColor(value), h = 16;
  doc.roundedRect(x, y, w, h, 8).fillAndStroke(bgColor, color);
  doc.fillColor(color).font(F_BOLD).fontSize(8.5).text(label, x, y + 3.5, { width: w, align: "center", lineBreak: false });
}

function drawTotalScoreBand(doc: PDFKit.PDFDocument, x: number, y: number, w: number, total: number) {
  doc.roundedRect(x, y, w, 26, 6).fill(NAVY);
  doc.fillColor("white").font(F_BOLD).fontSize(10).text("총점 (Total)", x + 14, y + 7, { lineBreak: false });
  doc.fillColor("white").font(F_REG).fontSize(9).text(scoreLabel(total), x + 80, y + 9, { lineBreak: false });
  doc.fillColor(GOLD).font(F_BOLD).fontSize(14).text(`${total} / 100`, x, y + 5, { width: w - 14, align: "right", lineBreak: false });
}

function scoreColor(v: number): string { return v >= 81 ? GREEN : v >= 70 ? GOLD : RED; }
function scoreSoftColor(v: number): string { return v >= 81 ? GREEN_SOFT : v >= 70 ? GOLD_SOFT : RED_SOFT; }
function scoreLabel(v: number): string {
  if (v >= 91) return "매우 잘함";
  if (v >= 81) return "잘하고 있어요";
  if (v >= 70) return "꾸준히 노력 중";
  return "좀 더 노력해요";
}

function drawDiagnosisCards(doc: PDFKit.PDFDocument, strengths: string[], improvements: string[], y: number): number {
  const x = 40, w = doc.page.width - 80, cardH = 145;
  drawListCard(doc, "강점 (Strengths)", "이런 점이 정말 잘 되고 있어요", strengths, GREEN, GREEN_SOFT, x, y, w, cardH);
  const y2 = y + cardH + 10;
  drawListCard(doc, "보완이 필요한 부분 (Development Points)", "조금만 더 신경 쓰면 한 단계 성장할 수 있어요", improvements, GOLD, GOLD_SOFT, x, y2, w, cardH);
  return y2 + cardH;
}

function drawListCard(doc: PDFKit.PDFDocument, title: string, subtitle: string, items: string[], accent: string, soft: string, x: number, y: number, w: number, h: number) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke(soft, accent);
  doc.rect(x, y, 4, h).fill(accent);
  doc.fillColor(accent).font(F_BOLD).fontSize(10.5).text(title, x + 14, y + 9, { lineBreak: false });
  doc.fillColor("#6b6b6b").font(F_REG).fontSize(8).text(subtitle, x + 14, y + 24, { lineBreak: false });
  let cy = y + 40;
  const maxY = y + h - 6, itemW = w - 40;
  for (const item of items) {
    if (!item.trim()) continue;
    doc.fillColor(GREY).font(F_REG).fontSize(9);
    const th = doc.heightOfString(item, { width: itemW - 12, lineGap: 2 });
    if (cy + th > maxY) break;
    doc.circle(x + 18, cy + 5, 1.8).fill(accent);
    doc.fillColor(GREY).font(F_REG).fontSize(9).text(item, x + 26, cy, { width: itemW - 12, lineGap: 2 });
    cy += th + 5;
  }
}

function drawSentenceClinic(doc: PDFKit.PDFDocument, best: AssessmentReport["bestSentence"], fix: AssessmentReport["correctionExample"], y: number): number {
  const x = 40, fullW = doc.page.width - 80, gap = 12, colW = (fullW - gap) / 2, h = 215;
  drawClinicCard(doc, "최고의 문장 (BEST SENTENCE)", best?.sentence ?? "(해당 시험에서 인용 가능한 문장이 없습니다)", best?.comment ?? "", BLUE, BLUE_SOFT, x, y, colW, h);
  drawClinicCard(doc, "교정 및 피드백 (CHECK & FIX)", fix?.original ?? "(교정 예시 없음)", fix ? `→ ${fix.corrected}\n${fix.reason}` : "", RED, RED_SOFT, x + colW + gap, y, colW, h);
  return y + h;
}

function drawClinicCard(doc: PDFKit.PDFDocument, title: string, quote: string, detail: string, accent: string, soft: string, x: number, y: number, w: number, h: number) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke(soft, accent);
  doc.rect(x, y, 4, h).fill(accent);
  doc.fillColor(accent).font(F_BOLD).fontSize(9.5).text(title, x + 12, y + 9, { lineBreak: false });
  const quoteText = `"${quote}"`, quoteInnerW = w - 36;
  doc.font(F_BOLD).fontSize(10);
  const quoteH = Math.max(42, Math.min(72, doc.heightOfString(quoteText, { width: quoteInnerW, lineGap: 2 }) + 12));
  const quoteY = y + 30;
  doc.roundedRect(x + 12, quoteY, w - 24, quoteH, 5).fill("white");
  doc.fillColor(NAVY).font(F_BOLD).fontSize(10).text(quoteText, x + 18, quoteY + 6, { width: quoteInnerW, height: quoteH - 8, lineGap: 2 });
  const detailY = quoteY + quoteH + 8;
  doc.fillColor(GREY).font(F_REG).fontSize(8.5).text(detail, x + 12, detailY, { width: w - 24, height: y + h - detailY - 10, lineGap: 2 });
}

function drawNextStepsList(doc: PDFKit.PDFDocument, items: string[], y: number): number {
  const x = 40, w = doc.page.width - 80, textW = w - 46, padTop = 8, itemGap = 6;
  doc.font(F_REG).fontSize(9.5);
  const heights = items.map((item) => item.trim() ? Math.max(20, doc.heightOfString(item, { width: textW, lineGap: 2 }) + 4) : 0);
  const totalH = padTop * 2 + heights.reduce((s, h) => s + h, 0) + Math.max(0, heights.filter((h) => h > 0).length - 1) * itemGap;
  doc.roundedRect(x, y, w, totalH, 6).fillAndStroke("#fafbfd", "#e0e3ec");
  let cy = y + padTop;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.trim()) continue;
    doc.circle(x + 20, cy + 8, 8).fill(NAVY);
    doc.fillColor("white").font(F_BOLD).fontSize(9).text(`${i + 1}`, x + 14, cy + 5, { width: 12, align: "center", lineBreak: false });
    doc.fillColor(GREY).font(F_REG).fontSize(9.5).text(item, x + 36, cy + 2, { width: textW, lineGap: 2 });
    cy += heights[i] + itemGap;
  }
  return y + totalH;
}

function drawParentMessage(doc: PDFKit.PDFDocument, message: string, meta: AssessmentMeta, y: number): number {
  const x = 40, w = doc.page.width - 80, h = Math.max(120, Math.min(180, doc.page.height - y - 90));
  doc.roundedRect(x, y, w, h, 10).fillAndStroke(GOLD_SOFT, GOLD);
  doc.rect(x, y, 4, h).fill(GOLD);
  doc.fillColor(NAVY).font(F_BOLD).fontSize(10.5).text(`${ACADEMY_NAME}에서 학부모님께`, x + 16, y + 12, { lineBreak: false });
  doc.strokeColor(GOLD).lineWidth(0.8).moveTo(x + 16, y + 30).lineTo(x + w - 16, y + 30).stroke();
  doc.fillColor(GREY).font(F_REG).fontSize(10).text(message, x + 18, y + 40, { width: w - 36, height: h - 64, lineGap: 3, ellipsis: true });
  doc.fillColor(NAVY).font(F_BOLD).fontSize(9).text(`담당 ${meta.teacherName} 드림`, x + 16, y + h - 18, { width: w - 32, align: "right", lineBreak: false });
  return y + h;
}

function drawSignature(doc: PDFKit.PDFDocument, meta: AssessmentMeta) {
  const range = doc.bufferedPageRange();
  doc.switchToPage(range.start + range.count - 1);
  const y = doc.page.height - 60;
  doc.strokeColor(GOLD).lineWidth(0.8).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
  doc.fillColor("#6b5a1f").font(F_REG).fontSize(7.5).text("본 평가서는 학생의 학업 성취도를 진단하고 학습 방향을 제안하기 위한 자료입니다.", 40, y + 6, { width: doc.page.width - 80, lineBreak: false });
  doc.fillColor(NAVY).font(F_BOLD).fontSize(8.5).text(`${ACADEMY_NAME}  ·  담당 ${meta.teacherName}`, 40, y + 6, { width: doc.page.width - 80, align: "right", lineBreak: false });
  void meta;
}

function drawPageFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fillColor("#aaa").font(F_REG).fontSize(8).text(
      `${ACADEMY_NAME}  |  학업 성취도 평가서  |  Page ${i - range.start + 1} / ${range.count}`,
      40, doc.page.height - 22, { width: doc.page.width - 80, align: "center", lineBreak: false },
    );
  }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
