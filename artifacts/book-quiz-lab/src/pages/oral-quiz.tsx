import { useState } from "react";
import { MessageCircle, Sparkles, Loader2, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { downloadPdfBase64, safeFilename } from "@/lib/download";
import { AppHeader } from "@/components/AppHeader";

import {
  useListBooks,
  useGenerateOralQuiz,
} from "@workspace/api-client-react";
import type { OralQuizInputLevel } from "@workspace/api-client-react";

const LEVEL_LABELS: Record<string, string> = {
  elementary4: "초등 4학년",
  elementary5: "초등 5학년",
  elementary6: "초등 6학년",
  middle: "중등",
};

const AUTHORS = ["이현진 원장", "이진미 강사", "강나영 강사"] as const;

export default function OralQuizPage() {
  const { data: books = [] } = useListBooks();
  const [bookId, setBookId] = useState<number | null>(null);
  const [level, setLevel] = useState<OralQuizInputLevel>("elementary4");
  const [author, setAuthor] = useState<string>(AUTHORS[0]);
  const { toast } = useToast();
  const generate = useGenerateOralQuiz();

  const selectedBook = books.find((b) => b.id === bookId) ?? null;

  if (bookId === null && books.length > 0) {
    setBookId(books[0].id);
  }

  const handleGenerate = () => {
    if (!selectedBook) return;
    generate.mutate(
      { bookId: selectedBook.id, data: { level, author } },
      {
        onSuccess: (result) => {
          const filename = `${safeFilename(selectedBook.title)}_구두질문지.pdf`;
          downloadPdfBase64(result.pdfBase64, filename);
          toast({
            title: "생성 완료!",
            description: `${result.questionCount}개 질문이 담긴 PDF가 다운로드되었습니다`,
          });
        },
        onError: () =>
          toast({
            title: "생성 실패",
            description: "AI 생성 중 문제가 발생했습니다. 다시 시도해 주세요.",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      <AppHeader />

      <div className="flex-1 max-w-3xl mx-auto w-full p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-[#1a2e5a] flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-[#c9a227]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1a2e5a]">구두 독해 질문지 (책 전체)</h2>
              <p className="text-sm text-slate-500">
                선택한 책의 전체 내용을 바탕으로 10개의 구두 질문과 모범 답안을 생성합니다
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-200 my-5" />

          {books.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">먼저 "챕터 자료" 탭에서 교재를 추가해 주세요</p>
            </div>
          ) : generate.isPending ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-12 h-12 animate-spin text-[#1a2e5a] mb-4" />
              <p className="font-semibold text-[#1a2e5a]">AI가 구두질문 10개를 만들고 있어요...</p>
              <p className="text-sm text-slate-500 mt-2">
                책 전체 내용을 바탕으로 모범 답안까지 생성합니다. 20~40초 정도 걸려요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>교재 선택</Label>
                <Select
                  value={bookId ? String(bookId) : ""}
                  onValueChange={(v) => setBookId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="교재를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {books.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>학년</Label>
                  <Select value={level} onValueChange={(v) => setLevel(v as OralQuizInputLevel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>담당 선생님</Label>
                  <Select value={author} onValueChange={setAuthor}>
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

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-[#1a2e5a]">이 페이지에서 생성되는 자료</p>
                <p>· 구두 독해 질문 10문항 + 모범 답안 (선생님용)</p>
                <p>· 질문 1~3: 인물·배경 회상 / 4~7: 사건·이유 이해 / 8~10: 추론·의견</p>
                <p>· 책 전체 내용을 기준으로 만들어집니다 (챕터 단위 X)</p>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!selectedBook}
                className="w-full bg-[#c9a227] hover:bg-[#b08c1f] text-[#1a2e5a] font-semibold gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                구두질문지 생성
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
