import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import {
  ClipboardCheck,
  Search,
  FileText,
  Trash2,
  Loader2,
  ArrowLeft,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { downloadPdfBase64, openPdfBase64 } from "@/lib/download";

const ACADEMY = "헬로펀키즈 주니어 어학원";

interface ListItem {
  id: number;
  studentName: string;
  teacherName: string;
  testTitle: string;
  createdAt: string;
  totalScore?: number;
}

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

export default function Archive() {
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = async () => {
    try {
      const res = await fetch(`/api/assessments`);
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

  useEffect(() => {
    load();
  }, []);

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
      const res = await fetch(`/api/assessments/${item.id}/pdf`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("PDF 재생성 실패");
      const data = (await res.json()) as { pdfBase64: string };
      if (openInTab) {
        openPdfBase64(data.pdfBase64);
      } else {
        downloadPdfBase64(
          data.pdfBase64,
          `${safeName(item.studentName)}_평가서_${dateForFile(item.createdAt)}.pdf`,
        );
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "다운로드 실패",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: ListItem) => {
    if (!confirm(`${item.studentName} 학생의 평가서를 삭제할까요?`)) return;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/assessments/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");
      setItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
      toast({ title: "평가서가 삭제되었습니다." });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "삭제 실패",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
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
            <p className="text-xs text-white/70 mt-0.5">평가서 아카이브</p>
          </div>
          <Link href="/">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
            >
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
                          {scoreLabel(item.totalScore)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>교재: {item.testTitle}</span>
                      <span>담당: {item.teacherName}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                      PDF 다운로드
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
    </div>
  );
}
