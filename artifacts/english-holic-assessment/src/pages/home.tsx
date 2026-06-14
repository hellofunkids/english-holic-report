import { useState, useRef } from "react";
import { Link } from "wouter";
import { apiUrl } from "../lib/apiBase";
import {
  BookOpen,
  Upload,
  X,
  FileText,
  Download,
  Loader2,
  ClipboardCheck,
  Archive as ArchiveIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  downloadPdfBase64,
  savePdfBase64,
  openPdfBase64,
  isMobileDevice,
} from "@/lib/download";

const AUTHORS = ["이현진 원장", "이진미 강사", "강나영 강사"] as const;
const DEFAULT_AUTHOR = AUTHORS[0];
const ACADEMY = "헬로펀키즈 주니어 어학원";
const TEST_TITLE = "영어홀릭";
const MAX_FILES = 8;
const BOOK_PLACEHOLDER = "예: Bridge Writing 1";

function scoreLabel(v: number): string {
  if (v >= 91) return "매우 잘함";
  if (v >= 81) return "잘하고 있어요";
  if (v >= 70) return "꾸준히 노력 중";
  return "좀 더 노력해요";
}
function scoreColor(v: number): string {
  if (v >= 81) return "#1a6b3a";
  if (v >= 70) return "#c9a227";
  return "#c0392b";
}

type Stage = "idle" | "uploading" | "done";

interface ReportPreview {
  overallComment: string;
  totalScore?: number;
  domainScores: {
    vocabulary: number;
    grammar: number;
    reading: number;
    writing: number;
  };
}

const DOMAIN_LABELS: Record<keyof ReportPreview["domainScores"], string> = {
  vocabulary: "어휘",
  grammar: "문법",
  reading: "독해",
  writing: "작문",
};

interface PickedFile {
  file: File;
  previewUrl: string | null;
  isHeic: boolean;
}

function isHeicFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith(".heic") ||
    n.endsWith(".heif") ||
    file.type.toLowerCase().includes("heic") ||
    file.type.toLowerCase().includes("heif")
  );
}

export default function Home() {
  const [studentName, setStudentName] = useState("");
  const [bookName, setBookName] = useState("");
  const [teacher, setTeacher] = useState<string>(DEFAULT_AUTHOR);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<{
    pdfBase64: string;
    report: ReportPreview;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const picked: PickedFile[] = [];
    for (const f of Array.from(list)) {
      const heic = isHeicFile(f);
      picked.push({
        file: f,
        previewUrl: heic ? null : URL.createObjectURL(f),
        isHeic: heic,
      });
    }
    setFiles((prev) => {
      const combined = [...prev, ...picked].slice(0, MAX_FILES);
      if (prev.length + picked.length > MAX_FILES) {
        toast({
          title: `최대 ${MAX_FILES}장까지만 업로드할 수 있습니다.`,
          variant: "destructive",
        });
      }
      return combined;
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const reset = () => {
    files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setStudentName("");
    setBookName("");
    setResult(null);
    setStage("idle");
  };

  const handleSubmit = async () => {
    if (!studentName.trim()) {
      toast({ title: "학생 이름을 입력해 주세요.", variant: "destructive" });
      return;
    }
    if (!bookName.trim()) {
      toast({ title: "교재명을 입력해 주세요.", variant: "destructive" });
      return;
    }
    if (files.length === 0) {
      toast({
        title: "시험지 사진을 1장 이상 올려 주세요.",
        variant: "destructive",
      });
      return;
    }

    setStage("uploading");
    const fd = new FormData();
    fd.append("studentName", studentName.trim());
    fd.append("teacherName", teacher);
    fd.append("testTitle", TEST_TITLE);
    fd.append("bookName", bookName.trim());
    files.forEach((f) => fd.append("images", f.file, f.file.name));

    try {
      const res = await fetch(apiUrl(`/api/assessments/generate`), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        let msg = "평가서 생성에 실패했습니다.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as {
        pdfBase64: string;
        report: ReportPreview;
      };
      setResult(data);
      setStage("done");
      if (isMobileDevice()) {
        toast({
          title: "평가서가 생성되었습니다.",
          description: "아래 ‘저장 / 공유’ 버튼을 눌러 PDF를 저장하세요.",
        });
      } else {
        downloadPdfBase64(
          data.pdfBase64,
          `${safeName(studentName)}_평가서_${dateForFile()}.pdf`,
        );
        toast({ title: "평가서가 생성되었습니다." });
      }
    } catch (err) {
      setStage("idle");
      toast({
        title: err instanceof Error ? err.message : "평가서 생성 실패",
        variant: "destructive",
      });
    }
  };

  const openPdf = () => {
    if (!result) return;
    openPdfBase64(result.pdfBase64);
  };

  const savePdf = async () => {
    if (!result) return;
    const filename = `${safeName(studentName)}_평가서_${dateForFile()}.pdf`;
    const shared = await savePdfBase64(result.pdfBase64, filename);
    if (!shared) {
      toast({ title: "PDF를 저장했습니다." });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <header className="bg-[#1a2e5a] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#c9a227] flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-[#1a2e5a]" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-lg leading-none">{ACADEMY}</h1>
            <p className="text-xs text-white/70 mt-0.5">
              영어홀릭 평가서 자동 생성
            </p>
          </div>
          <Link href="/archive">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <ArchiveIcon className="w-4 h-4 mr-1" /> 평가서 아카이브
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-[#1a2e5a] mb-1 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#c9a227]" />
            영어홀릭 학업 성취도 평가서
          </h2>
          <p className="text-sm text-slate-600">
            시험지 사진을 올리면 AI가 채점·분석해서 학부모님께 보낼 평가서 PDF를
            만들어 드립니다. (최대 {MAX_FILES}장 · HEIC/JPG/PNG)
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="student">학생 이름</Label>
              <Input
                id="student"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="예: 김민준"
                disabled={stage === "uploading"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="book">교재명</Label>
              <Input
                id="book"
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                placeholder={BOOK_PLACEHOLDER}
                disabled={stage === "uploading"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>담당 선생님</Label>
              <Select
                value={teacher}
                onValueChange={setTeacher}
                disabled={stage === "uploading"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTHORS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>
              시험지 사진 ({files.length}/{MAX_FILES})
            </Label>
            <div
              className="mt-2 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#c9a227] hover:bg-amber-50/40 transition"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
            >
              <Upload className="w-8 h-8 mx-auto text-[#c9a227] mb-2" />
              <p className="text-sm text-slate-700 font-medium">
                여기를 눌러 사진을 선택하거나 끌어다 놓으세요
              </p>
              <p className="text-xs text-slate-500 mt-1">
                아이폰 HEIC 파일 자동 변환 · 최대 {MAX_FILES}장
              </p>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/*,.heic,.heif,.HEIC,.HEIF"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {files.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-4">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                  >
                    {f.previewUrl ? (
                      <img
                        src={f.previewUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-slate-500 p-1 text-center">
                        <FileText className="w-6 h-6 mb-1 text-[#c9a227]" />
                        HEIC
                        <span className="truncate w-full mt-0.5">
                          {f.file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center"
                      disabled={stage === "uploading"}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 justify-end pt-2 border-t border-slate-100">
            {stage === "done" && (
              <Button variant="outline" onClick={reset}>
                새로 만들기
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={stage === "uploading"}
              className="bg-[#1a2e5a] hover:bg-[#152448] text-white"
            >
              {stage === "uploading" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI 분석 중…
                  (30~90초)
                </>
              ) : (
                "평가서 생성"
              )}
            </Button>
          </div>
        </div>

        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-[#1a2e5a] text-lg">
                  {studentName} 학생 평가서
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  담당 {teacher} · {new Date().toLocaleDateString("ko-KR")}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  onClick={openPdf}
                  variant="outline"
                  className="border-[#1a2e5a] text-[#1a2e5a] hover:bg-slate-50"
                >
                  <FileText className="w-4 h-4 mr-1" /> PDF 열기
                </Button>
                <Button
                  onClick={savePdf}
                  className="bg-[#c9a227] hover:bg-[#b08e1f] text-[#1a2e5a]"
                >
                  <Download className="w-4 h-4 mr-1" /> 저장 / 공유
                </Button>
              </div>
            </div>

            {typeof result.report.totalScore === "number" && (
              <div className="bg-[#1a2e5a] text-white rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm">총점</span>
                  <span className="text-xs text-slate-300">
                    {scoreLabel(result.report.totalScore)}
                  </span>
                </div>
                <span className="text-2xl font-bold text-[#c9a227]">
                  {result.report.totalScore}점
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(
                Object.keys(DOMAIN_LABELS) as Array<keyof typeof DOMAIN_LABELS>
              ).map((k) => {
                const v = result.report.domainScores[k];
                const color = scoreColor(v);
                return (
                  <div
                    key={k}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <p className="text-xs text-slate-500">{DOMAIN_LABELS[k]}</p>
                    <p
                      className="text-xl font-bold mt-1"
                      style={{ color }}
                    >
                      {v}점
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {scoreLabel(v)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-[#1a2e5a] mb-1">총평</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {result.report.overallComment}
              </p>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-slate-400 pt-4 pb-2">
          {ACADEMY} · 영어홀릭 평가서 시스템
        </footer>
      </main>
    </div>
  );
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_").trim() || "student";
}

function dateForFile(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
