import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { apiUrl } from "../lib/apiBase";
import {
  ClipboardCheck,
  Search,
  FileText,
  Trash2,
  Loader2,
  ArrowLeft,
  Inbox,
  Pencil,
  Save,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  savePdfBase64,
  openPdfBase64,
  isMobileDevice,
} from "@/lib/download";

const ACADEMY = "헬로펀키즈 주니어 어학원";

interface AssessmentReport {
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

interface ListItem {
  id: number;
  studentName: string;
  teacherName: string;
  testTitle: string;
  createdAt: string;
  totalScore?: number;
}

const DOMAIN_LABELS: Record<keyof AssessmentReport["domainScores"], string> = {
  vocabulary: "어휘",
  grammar: "문법",
  reading: "독해",
  writing: "작문",
};

function scoreLabel(v: number): string {
  if (v >= 91) return "매우 잘함";
  if (v >= 81) return "잘하고 있어요";
  if (v >= 70) return "꾸준히 노력 중";
  return "좀 더 노력해요";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_").trim() || "student";
}

function dateForFile(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function clampScore(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export default function Archive() {
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const { toast } = useToast();

  // Edit sheet state
  const [editItem, setEditItem] = useState<ListItem | null>(null);
  const [draft, setDraft] = useState<AssessmentReport | null>(null);
  const [editPdfBase64, setEditPdfBase64] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(apiUrl(`/api/assessments`));
      if (!res.ok) throw new Error("목록을 불러오지 못했습니다.");
      const data = (await res.json()) as ListItem[];
      setItems(data);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "목록 로드 실패",
        variant: "destructive",
      });
      setItems([]);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.studentName.toLowerCase().includes(q) ||
        i.teacherName.toLowerCase().includes(q) ||
        i.testTitle.toLowerCase().includes(q),
    );
  }, [items, query]);

  const handleDownload = async (item: ListItem, openInTab = false) => {
    setBusyId(item.id);
    try {
      const res = await fetch(apiUrl(`/api/assessments/${item.id}/pdf`), { method: "POST" });
      if (!res.ok) throw new Error("PDF 재생성 실패");
      const data = (await res.json()) as { pdfBase64: string };
      if (openInTab || isMobileDevice()) {
        openPdfBase64(data.pdfBase64);
      } else {
        await savePdfBase64(
          data.pdfBase64,
          `${safeName(item.studentName)}_평가서_${dateForFile(item.createdAt)}.pdf`,
        );
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "다운로드 실패", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: ListItem) => {
    if (!confirm(`${item.studentName} 학생의 평가서를 삭제할까요?`)) return;
    setBusyId(item.id);
    try {
      const res = await fetch(apiUrl(`/api/assessments/${item.id}`), { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
      toast({ title: "평가서가 삭제되었습니다." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "삭제 실패", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  // 수정 패널 열기 — 서버에서 전체 리포트 불러오기
  const handleOpenEdit = async (item: ListItem) => {
    setEditItem(item);
    setDraft(null);
    setEditPdfBase64(null);
    setSheetOpen(true);
    setEditLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/assessments/${item.id}/pdf`), { method: "POST" });
      if (!res.ok) throw new Error("데이터 로드 실패");
      const data = (await res.json()) as {
        pdfBase64: string;
        report: AssessmentReport;
      };
      setDraft(JSON.parse(JSON.stringify(data.report)) as AssessmentReport);
      setEditPdfBase64(data.pdfBase64);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "로드 실패", variant: "destructive" });
      setSheetOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  // 수정 저장 — PATCH → 새 PDF 받기
  const handleSaveEdit = async () => {
    if (!editItem || !draft) return;
    setEditSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/assessments/${editItem.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "저장 실패");
      }
      const data = (await res.json()) as { pdfBase64: string; report: AssessmentReport };
      setEditPdfBase64(data.pdfBase64);
      setDraft(JSON.parse(JSON.stringify(data.report)) as AssessmentReport);
      // 목록의 총점도 업데이트
      setItems((prev) =>
        prev
          ? prev.map((i) =>
              i.id === editItem.id ? { ...i, totalScore: data.report.totalScore } : i,
            )
          : prev,
      );
      toast({ title: "수정사항이 저장되었습니다. 아래 버튼으로 PDF를 다운로드하세요." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "저장 실패", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  // 현재 편집된 PDF 다운로드
  const handleDownloadEdited = async (open = false) => {
    if (!editItem || !editPdfBase64) return;
    const filename = `${safeName(editItem.studentName)}_평가서_${dateForFile(editItem.createdAt)}.pdf`;
    if (open || isMobileDevice()) {
      openPdfBase64(editPdfBase64);
    } else {
      await savePdfBase64(editPdfBase64, filename);
    }
  };

  // Draft helpers
  const setDraftField = <K extends keyof AssessmentReport>(key: K, value: AssessmentReport[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : null));

  const setDraftScore = (key: keyof AssessmentReport["domainScores"], raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n))
      setDraft((prev) =>
        prev ? { ...prev, domainScores: { ...prev.domainScores, [key]: clampScore(n) } } : null,
      );
  };

  const setDraftArray = (
    key: "strengths" | "improvements" | "nextSteps",
    idx: number,
    value: string,
  ) =>
    setDraft((prev) => {
      if (!prev) return null;
      const arr = [...prev[key]];
      arr[idx] = value;
      return { ...prev, [key]: arr };
    });

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <header className="bg-[#1a2e5a] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#c9a227] flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-[#1a2e5a]" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-lg leading-none">{ACADEMY}</h1>
            <p className="text-xs text-white/70 mt-0.5">평가서 아카이브</p>
          </div>
          <Link href="/">
            <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" /> 새 평가서 만들기
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="학생 이름·선생님·교재명으로 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-xs text-slate-500 whitespace-nowrap">
              총 {items?.length ?? 0}건
              {query && filtered.length !== items?.length && (
                <span> · 검색결과 {filtered.length}건</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {items === null ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c9a227]" />
              불러오는 중…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Inbox className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              {items.length === 0
                ? "아직 생성된 평가서가 없습니다."
                : "검색 결과가 없습니다."}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className="px-5 py-4 flex flex-wrap items-center gap-4 hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#1a2e5a] text-base">
                        {item.studentName}
                      </span>
                      {typeof item.totalScore === "number" && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#1a2e5a] text-[#c9a227]">
                          {item.totalScore}점 · {scoreLabel(item.totalScore)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>교재: {item.testTitle}</span>
                      <span>담당: {item.teacherName}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(item)}
                      disabled={busyId === item.id}
                      className="border-[#1a2e5a] text-[#1a2e5a] hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" /> 수정
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(item, true)}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 mr-1" />
                      )}
                      열기
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDownload(item, false)}
                      disabled={busyId === item.id}
                      className="bg-[#c9a227] hover:bg-[#b08e1f] text-[#1a2e5a]"
                    >
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item)}
                      disabled={busyId === item.id}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="text-center text-xs text-slate-400 pt-4 pb-2">
          {ACADEMY} · 영어홀릭 평가서 시스템
        </footer>
      </main>

      {/* 수정 슬라이드 패널 */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto p-0"
        >
          <SheetHeader className="px-6 py-5 border-b border-slate-100 bg-[#1a2e5a] text-white sticky top-0 z-10">
            <SheetTitle className="text-white text-base">
              {editItem?.studentName} 학생 평가서 수정
            </SheetTitle>
            <p className="text-xs text-white/70 mt-0.5">
              교재: {editItem?.testTitle} · {editItem?.teacherName}
            </p>
          </SheetHeader>

          {editLoading || !draft ? (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2 text-[#c9a227]" />
              데이터 불러오는 중…
            </div>
          ) : (
            <div className="px-6 py-6 space-y-6">
              {/* PDF 다운로드 버튼 (상단 고정) */}
              {editPdfBase64 && (
                <div className="flex gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex-1 text-xs text-amber-800">
                    수정 후 저장하면 새 PDF가 생성됩니다.
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadEdited(true)}
                      className="border-[#1a2e5a] text-[#1a2e5a] text-xs"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" /> 열기
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDownloadEdited(false)}
                      className="bg-[#c9a227] hover:bg-[#b08e1f] text-[#1a2e5a] text-xs"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" /> 다운로드
                    </Button>
                  </div>
                </div>
              )}

              {/* 점수 */}
              <section className="space-y-3">
                <h4 className="text-sm font-bold text-[#1a2e5a] border-b border-slate-100 pb-2">점수 조정</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">총점 (0~100)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.totalScore ?? ""}
                      onChange={(e) =>
                        setDraftField(
                          "totalScore",
                          e.target.value === "" ? undefined : clampScore(parseInt(e.target.value, 10)),
                        )
                      }
                      className="h-9 text-base font-bold"
                    />
                  </div>
                  {(Object.keys(DOMAIN_LABELS) as Array<keyof AssessmentReport["domainScores"]>).map((k) => (
                    <div key={k} className="space-y-1">
                      <Label className="text-xs">{DOMAIN_LABELS[k]} (0~100)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.domainScores[k]}
                        onChange={(e) => setDraftScore(k, e.target.value)}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* 총평 */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-[#1a2e5a] border-b border-slate-100 pb-2">총평</h4>
                <Textarea
                  rows={4}
                  value={draft.overallComment}
                  onChange={(e) => setDraftField("overallComment", e.target.value)}
                  className="resize-none text-sm"
                />
              </section>

              {/* 잘한 점 */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-[#1a2e5a] border-b border-slate-100 pb-2">잘한 점</h4>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-[#c9a227] font-bold text-sm mt-2 w-4 shrink-0">{i + 1}.</span>
                      <Textarea
                        rows={2}
                        value={draft.strengths[i] ?? ""}
                        onChange={(e) => setDraftArray("strengths", i, e.target.value)}
                        className="resize-none text-sm flex-1"
                        placeholder={`잘한 점 ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* 보완할 점 */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-[#1a2e5a] border-b border-slate-100 pb-2">보완할 점</h4>
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-[#c9a227] font-bold text-sm mt-2 w-4 shrink-0">{i + 1}.</span>
                      <Textarea
                        rows={2}
                        value={draft.improvements[i] ?? ""}
                        onChange={(e) => setDraftArray("improvements", i, e.target.value)}
                        className="resize-none text-sm flex-1"
                        placeholder={`보완할 점 ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* 다음 학습 제안 */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-[#1a2e5a] border-b border-slate-100 pb-2">다음 학습 제안</h4>
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-[#c9a227] font-bold text-sm mt-2 w-4 shrink-0">{i + 1}.</span>
                      <Textarea
                        rows={2}
                        value={draft.nextSteps[i] ?? ""}
                        onChange={(e) => setDraftArray("nextSteps", i, e.target.value)}
                        className="resize-none text-sm flex-1"
                        placeholder={`학습 제안 ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* 최고의 문장 */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-[#1a2e5a] border-b border-slate-100 pb-2">최고의 문장 (선택)</h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">문장 (영어)</Label>
                    <Input
                      value={draft.bestSentence?.sentence ?? ""}
                      onChange={(e) =>
                        setDraftField("bestSentence", {
                          sentence: e.target.value,
                          comment: draft.bestSentence?.comment ?? "",
                        })
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">코멘트</Label>
                    <Textarea
                      rows={2}
                      value={draft.bestSentence?.comment ?? ""}
                      onChange={(e) =>
                        setDraftField("bestSentence", {
                          sentence: draft.bestSentence?.sentence ?? "",
                          comment: e.target.value,
                        })
                      }
                      className="resize-none text-sm"
                    />
                  </div>
                </div>
              </section>

              {/* 교정 예시 */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-[#1a2e5a] border-b border-slate-100 pb-2">교정 예시 (선택)</h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">원문</Label>
                    <Input
                      value={draft.correctionExample?.original ?? ""}
                      onChange={(e) =>
                        setDraftField("correctionExample", {
                          original: e.target.value,
                          corrected: draft.correctionExample?.corrected ?? "",
                          reason: draft.correctionExample?.reason ?? "",
                        })
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">교정 문장</Label>
                    <Input
                      value={draft.correctionExample?.corrected ?? ""}
                      onChange={(e) =>
                        setDraftField("correctionExample", {
                          original: draft.correctionExample?.original ?? "",
                          corrected: e.target.value,
                          reason: draft.correctionExample?.reason ?? "",
                        })
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">교정 이유</Label>
                    <Textarea
                      rows={2}
                      value={draft.correctionExample?.reason ?? ""}
                      onChange={(e) =>
                        setDraftField("correctionExample", {
                          original: draft.correctionExample?.original ?? "",
                          corrected: draft.correctionExample?.corrected ?? "",
                          reason: e.target.value,
                        })
                      }
                      className="resize-none text-sm"
                    />
                  </div>
                </div>
              </section>

              {/* 학부모 메시지 */}
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-[#1a2e5a] border-b border-slate-100 pb-2">학부모 메시지 (선택)</h4>
                <Textarea
                  rows={4}
                  value={draft.parentMessage ?? ""}
                  onChange={(e) => setDraftField("parentMessage", e.target.value || undefined)}
                  placeholder="어머님/아버님께 전달할 메시지를 입력하세요."
                  className="resize-none text-sm"
                />
              </section>

              {/* 저장 버튼 (하단 고정) */}
              <div className="sticky bottom-0 bg-white border-t border-slate-100 -mx-6 px-6 py-4 flex gap-3">
                <Button
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="flex-1 bg-[#1a2e5a] hover:bg-[#152448] text-white"
                >
                  {editSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 저장 중…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" /> 저장 및 PDF 재생성
                    </>
                  )}
                </Button>
                {editPdfBase64 && (
                  <Button
                    onClick={() => handleDownloadEdited(isMobileDevice())}
                    className="bg-[#c9a227] hover:bg-[#b08e1f] text-[#1a2e5a]"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    {isMobileDevice() ? "열기" : "다운로드"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
