import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Plus,
  Sparkles,
  FileText,
  ClipboardList,
  BookText,
  Key,
  Trash2,
  Loader2,
  Download,
  Pencil,
  MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { downloadPdfBase64, openPdfBase64, safeFilename } from "@/lib/download";

import {
  useListBooks,
  useCreateBook,
  useUpdateBook,
  useDeleteBook,
  useListMaterials,
  getListMaterialsQueryKey,
  getListBooksQueryKey,
  useGenerateMaterials,
  useDeleteMaterial,
  useDownloadMaterialPdf,
} from "@workspace/api-client-react";
import type { Book, MaterialSummary, GenerateInputLevel } from "@workspace/api-client-react";

const LEVEL_LABELS: Record<string, string> = {
  elementary4: "초등 4학년",
  elementary5: "초등 5학년",
  elementary6: "초등 6학년",
  middle: "중등",
};

const AUTHORS = ["이현진 원장", "이진미 강사", "강나영 강사"] as const;
const DEFAULT_AUTHOR = AUTHORS[0];

export default function Home() {
  const { data: books = [] } = useListBooks();
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

  const selectedBook = books.find((b) => b.id === selectedBookId) ?? books[0] ?? null;

  // Auto-select first book if none selected and books loaded
  if (selectedBookId === null && books.length > 0) {
    setSelectedBookId(books[0].id);
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1a2e5a] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#c9a227] flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#1a2e5a]" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">헬로펀키즈 주니어 어학원</h1>
              <p className="text-xs text-white/70 mt-0.5">Book Quiz Lab · AI 시험지 자동 생성</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main 2-column layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 p-6">
        <BookSidebar
          books={books}
          selectedBookId={selectedBook?.id ?? null}
          onSelect={setSelectedBookId}
        />

        {selectedBook ? (
          <BookPanel book={selectedBook} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
            <BookOpen className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">교재가 없습니다</h3>
            <p className="text-sm text-slate-500 mt-2">
              왼쪽에서 교재를 추가해 주세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Book Sidebar ────────────────────────────────────────────────────────────
function BookSidebar({
  books,
  selectedBookId,
  onSelect,
}: {
  books: Book[];
  selectedBookId: number | null;
  onSelect: (id: number) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <aside className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col h-fit lg:sticky lg:top-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-[#1a2e5a]">교재 목록</h2>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="bg-[#1a2e5a] hover:bg-[#142348] gap-1"
        >
          <Plus className="w-4 h-4" />
          추가
        </Button>
      </div>

      {books.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">아직 교재가 없습니다</p>
      ) : (
        <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
          {books.map((b) => {
            const active = b.id === selectedBookId;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelect(b.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                    active
                      ? "bg-[#1a2e5a] text-white shadow-sm"
                      : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <p className="font-semibold text-sm truncate">{b.title}</p>
                  {b.description ? (
                    <p
                      className={`text-xs mt-0.5 truncate ${
                        active ? "text-white/70" : "text-slate-500"
                      }`}
                    >
                      {b.description}
                    </p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AddBookDialog open={addOpen} onOpenChange={setAddOpen} onCreated={onSelect} />
    </aside>
  );
}

function AddBookDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateBook({
    mutation: {
      onSuccess: (book) => {
        qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
        toast({ title: "교재가 추가되었습니다", description: book.title });
        onCreated(book.id);
        setTitle("");
        setDescription("");
        onOpenChange(false);
      },
      onError: () =>
        toast({ title: "추가 실패", description: "다시 시도해 주세요", variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>교재 추가</DialogTitle>
          <DialogDescription>책 제목을 입력해 주세요</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="book-title">책 제목 *</Label>
            <Input
              id="book-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Charlotte's Web"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="book-desc">설명 (선택)</Label>
            <Input
              id="book-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: E.B. White의 동화"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate({ data: { title: title.trim(), description: description.trim() || undefined } })}
            className="bg-[#1a2e5a] hover:bg-[#142348]"
          >
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Book Panel ──────────────────────────────────────────────────────────────
function BookPanel({ book }: { book: Book }) {
  const { data: materials = [] } = useListMaterials(book.id);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <main className="space-y-6">
      {/* Book header card */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#1a2e5a] truncate">{book.title}</h1>
            {book.description ? (
              <p className="text-slate-600 mt-1">{book.description}</p>
            ) : null}
            <p className="text-xs text-slate-400 mt-2">
              저장된 자료 {materials.length}개
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1">
              <Pencil className="w-4 h-4" />
              편집
            </Button>
            <Button
              size="sm"
              onClick={() => setGenerateOpen(true)}
              className="bg-[#c9a227] hover:bg-[#b08c1f] text-[#1a2e5a] font-semibold gap-1.5"
            >
              <Sparkles className="w-4 h-4" />새 자료 생성
            </Button>
          </div>
        </div>
      </section>

      {/* Materials list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-[#1a2e5a]">아카이브</h2>
        </div>

        {materials.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">아직 생성된 자료가 없습니다</p>
            <p className="text-sm text-slate-500 mt-1">
              상단의 "새 자료 생성" 버튼으로 시작해 보세요
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence>
              {materials.map((m) => (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <MaterialCard material={m} bookId={book.id} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <GenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        book={book}
      />
      <EditBookDialog open={editOpen} onOpenChange={setEditOpen} book={book} />
    </main>
  );
}

// ─── Edit Book Dialog ────────────────────────────────────────────────────────
function EditBookDialog({
  open,
  onOpenChange,
  book,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  book: Book;
}) {
  const [title, setTitle] = useState(book.title);
  const [description, setDescription] = useState(book.description ?? "");
  // Sync local state when the selected book changes
  useEffect(() => {
    setTitle(book.title);
    setDescription(book.description ?? "");
  }, [book.id, book.title, book.description]);

  const qc = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateBook({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
        toast({ title: "교재가 수정되었습니다" });
        onOpenChange(false);
      },
    },
  });
  const del = useDeleteBook({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBooksQueryKey() });
        toast({ title: "교재가 삭제되었습니다" });
        onOpenChange(false);
      },
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>교재 편집</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>책 제목</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>설명</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(`"${book.title}" 교재와 모든 자료를 삭제할까요?`)) {
                del.mutate({ bookId: book.id });
              }
            }}
            disabled={del.isPending}
            className="gap-1"
          >
            <Trash2 className="w-4 h-4" />삭제
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              disabled={!title.trim() || update.isPending}
              onClick={() =>
                update.mutate({
                  bookId: book.id,
                  data: { title: title.trim(), description: description.trim() || undefined },
                })
              }
              className="bg-[#1a2e5a] hover:bg-[#142348]"
            >
              저장
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Generate Dialog ─────────────────────────────────────────────────────────
function GenerateDialog({
  open,
  onOpenChange,
  book,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  book: Book;
}) {
  const [chapterTitle, setChapterTitle] = useState("");
  const [level, setLevel] = useState<GenerateInputLevel>("elementary4");
  const [author, setAuthor] = useState<string>(DEFAULT_AUTHOR);
  const qc = useQueryClient();
  const { toast } = useToast();
  const generate = useGenerateMaterials();

  const handleGenerate = () => {
    if (!chapterTitle.trim()) return;
    generate.mutate(
      { bookId: book.id, data: { chapterTitle: chapterTitle.trim(), level, author } },
      {
        onSuccess: (result) => {
          qc.invalidateQueries({ queryKey: getListMaterialsQueryKey(book.id) });
          const base = `${safeFilename(book.title)}_${safeFilename(chapterTitle.trim())}`;
          // Auto-download all 4 PDFs
          downloadPdfBase64(result.vocabListPdfBase64, `${base}_단어장.pdf`);
          downloadPdfBase64(result.vocabQuizPdfBase64, `${base}_어휘퀴즈.pdf`);
          downloadPdfBase64(result.readingQuizPdfBase64, `${base}_독해퀴즈.pdf`);
          downloadPdfBase64(result.answerKeyPdfBase64, `${base}_정답지.pdf`);
          downloadPdfBase64(result.oralQuizPdfBase64, `${base}_구두질문.pdf`);
          toast({
            title: "생성 완료!",
            description: "5개의 PDF가 다운로드되었습니다",
          });
          setChapterTitle("");
          onOpenChange(false);
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
    <Dialog open={open} onOpenChange={(v) => !generate.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#c9a227]" />
            AI 자료 생성
          </DialogTitle>
          <DialogDescription>
            "{book.title}"의 챕터/섹션에 대한 자료를 자동 생성합니다
          </DialogDescription>
        </DialogHeader>

        {generate.isPending ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#1a2e5a] mb-4" />
            <p className="font-semibold text-[#1a2e5a]">AI가 자료를 생성 중입니다...</p>
            <p className="text-sm text-slate-500 mt-2">
              단어장, 어휘퀴즈, 독해퀴즈, 정답지, 구두질문지를 한 번에 만들고 있어요. 잠시만 기다려 주세요.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <Label htmlFor="chapter-title">챕터 / 섹션 *</Label>
                <Input
                  id="chapter-title"
                  value={chapterTitle}
                  onChange={(e) => setChapterTitle(e.target.value)}
                  placeholder="예: Chapter 1, Part 2, 1-3장"
                  autoFocus
                />
              </div>
              <div>
                <Label>학년</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as GenerateInputLevel)}>
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-[#1a2e5a]">생성되는 자료 5종</p>
                <p>· 단어장 (20개 단어 + 한글 발음 + 뜻 + 예문)</p>
                <p>· 어휘 퀴즈지 (20문항, 빈칸/뜻 고르기/단어 고르기/스펠링 쓰기)</p>
                <p>· 독해 퀴즈지 (20문항 객관식)</p>
                <p>· 정답지 (어휘 + 독해 통합)</p>
                <p>· 구두 독해 질문지 (10문항 + 모범 답안, 선생님용)</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!chapterTitle.trim()}
                className="bg-[#c9a227] hover:bg-[#b08c1f] text-[#1a2e5a] font-semibold gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                생성 시작
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Material Card ───────────────────────────────────────────────────────────
type PdfBundleKey =
  | "vocabListPdfBase64"
  | "vocabQuizPdfBase64"
  | "readingQuizPdfBase64"
  | "answerKeyPdfBase64"
  | "oralQuizPdfBase64";

type LoadedBundle = Partial<Record<PdfBundleKey, string>>;

function MaterialCard({ material, bookId }: { material: MaterialSummary; bookId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const download = useDownloadMaterialPdf();
  const del = useDeleteMaterial({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMaterialsQueryKey(bookId) });
        toast({ title: "자료가 삭제되었습니다" });
      },
    },
  });

  // Cache the fetched PDF bundle so repeated "view" clicks don't re-call the server.
  const [bundle, setBundle] = useState<LoadedBundle | null>(null);
  const [pendingAction, setPendingAction] =
    useState<null | { kind: "download" } | { kind: "view"; key: PdfBundleKey; filename: string }>(
      null,
    );

  const baseName = `${safeFilename(material.bookTitle)}_${safeFilename(material.chapterTitle)}`;
  const fileNames: Record<PdfBundleKey, string> = {
    vocabListPdfBase64: `${baseName}_단어장.pdf`,
    vocabQuizPdfBase64: `${baseName}_어휘퀴즈.pdf`,
    readingQuizPdfBase64: `${baseName}_독해퀴즈.pdf`,
    answerKeyPdfBase64: `${baseName}_정답지.pdf`,
    oralQuizPdfBase64: `${baseName}_구두질문.pdf`,
  };
  const hasOral = (material.oralQuizCount ?? 0) > 0;

  const ensureBundle = (then: (b: LoadedBundle) => void) => {
    if (bundle) {
      then(bundle);
      return;
    }
    download.mutate(
      { materialId: material.id },
      {
        onSuccess: (result) => {
          const b: LoadedBundle = {
            vocabListPdfBase64: result.vocabListPdfBase64,
            vocabQuizPdfBase64: result.vocabQuizPdfBase64,
            readingQuizPdfBase64: result.readingQuizPdfBase64,
            answerKeyPdfBase64: result.answerKeyPdfBase64,
            ...(result.oralQuizPdfBase64
              ? { oralQuizPdfBase64: result.oralQuizPdfBase64 }
              : {}),
          };
          setBundle(b);
          then(b);
        },
        onError: () =>
          toast({ title: "불러오기 실패", description: "다시 시도해 주세요", variant: "destructive" }),
        onSettled: () => setPendingAction(null),
      },
    );
  };

  const handleDownloadAll = () => {
    setPendingAction({ kind: "download" });
    ensureBundle((b) => {
      if (b.vocabListPdfBase64) downloadPdfBase64(b.vocabListPdfBase64, fileNames.vocabListPdfBase64);
      if (b.vocabQuizPdfBase64) downloadPdfBase64(b.vocabQuizPdfBase64, fileNames.vocabQuizPdfBase64);
      if (b.readingQuizPdfBase64) downloadPdfBase64(b.readingQuizPdfBase64, fileNames.readingQuizPdfBase64);
      if (b.answerKeyPdfBase64) downloadPdfBase64(b.answerKeyPdfBase64, fileNames.answerKeyPdfBase64);
      if (b.oralQuizPdfBase64) downloadPdfBase64(b.oralQuizPdfBase64, fileNames.oralQuizPdfBase64);
      const count = [
        b.vocabListPdfBase64,
        b.vocabQuizPdfBase64,
        b.readingQuizPdfBase64,
        b.answerKeyPdfBase64,
        b.oralQuizPdfBase64,
      ].filter(Boolean).length;
      toast({ title: `${count}개의 PDF가 다운로드되었습니다` });
      setPendingAction(null);
    });
  };

  const handleView = (key: PdfBundleKey) => {
    setPendingAction({ kind: "view", key, filename: fileNames[key] });
    ensureBundle((b) => {
      const data = b[key];
      if (data) openPdfBase64(data);
      else toast({ title: "이 자료는 이 버전에서 사용할 수 없어요", variant: "destructive" });
      setPendingAction(null);
    });
  };

  const date = new Date(material.createdAt);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;

  const isLoading = download.isPending;
  const isViewing = (key: PdfBundleKey) =>
    isLoading && pendingAction?.kind === "view" && pendingAction.key === key;
  const isDownloadingAll = isLoading && pendingAction?.kind === "download";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-[#c9a227] transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[#1a2e5a]">{material.chapterTitle}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a2e5a]/10 text-[#1a2e5a] font-medium">
              {LEVEL_LABELS[material.level] ?? material.level}
            </span>
            {material.author ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#c9a227]/15 text-[#7a6014] font-medium">
                {material.author}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500 mt-1">{dateStr} 생성</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("이 자료를 삭제할까요?")) del.mutate({ materialId: material.id });
          }}
          className="text-slate-400 hover:text-red-600 hover:bg-red-50 -mr-2"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-[11px] text-slate-500 mb-1.5">파일을 클릭하면 새 창에서 열립니다</p>
      <div className="grid grid-cols-5 gap-2 mb-3">
        <PdfBadge
          icon={BookText}
          label="단어장"
          count={material.vocabCount}
          loading={isViewing("vocabListPdfBase64")}
          disabled={isLoading}
          onClick={() => handleView("vocabListPdfBase64")}
        />
        <PdfBadge
          icon={ClipboardList}
          label="어휘퀴즈"
          count={material.vocabQuizCount}
          loading={isViewing("vocabQuizPdfBase64")}
          disabled={isLoading}
          onClick={() => handleView("vocabQuizPdfBase64")}
        />
        <PdfBadge
          icon={FileText}
          label="독해퀴즈"
          count={material.readingQuizCount}
          loading={isViewing("readingQuizPdfBase64")}
          disabled={isLoading}
          onClick={() => handleView("readingQuizPdfBase64")}
        />
        <PdfBadge
          icon={Key}
          label="정답지"
          loading={isViewing("answerKeyPdfBase64")}
          disabled={isLoading}
          onClick={() => handleView("answerKeyPdfBase64")}
        />
        <PdfBadge
          icon={MessageCircle}
          label="구두질문"
          count={hasOral ? material.oralQuizCount : undefined}
          loading={isViewing("oralQuizPdfBase64")}
          disabled={isLoading || !hasOral}
          onClick={() => handleView("oralQuizPdfBase64")}
        />
      </div>

      <Button
        onClick={handleDownloadAll}
        disabled={isLoading}
        className="w-full bg-[#1a2e5a] hover:bg-[#142348] gap-2"
      >
        {isDownloadingAll ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {hasOral ? "5개 PDF 모두 다운로드" : "4개 PDF 모두 다운로드"}
      </Button>
    </div>
  );
}

function PdfBadge({
  icon: Icon,
  label,
  count,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-1 py-2 px-1 bg-slate-50 rounded-lg border border-slate-100 hover:bg-[#c9a227]/10 hover:border-[#c9a227] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 text-[#c9a227] animate-spin" />
      ) : (
        <Icon className="w-4 h-4 text-[#c9a227]" />
      )}
      <p className="text-[11px] font-semibold text-[#1a2e5a]">{label}</p>
      {count !== undefined ? <p className="text-[10px] text-slate-500">{count}개</p> : null}
    </button>
  );
}
