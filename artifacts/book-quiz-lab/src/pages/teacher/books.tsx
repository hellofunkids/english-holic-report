import { useRef, useState } from "react";
import { TeacherLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  useListBooks,
  useCreateBook,
  useDeleteBook,
  useListChapters,
  useCreateChapter,
  useDeleteChapter,
  getListBooksQueryKey,
  getListChaptersQueryKey,
  useRequestUploadUrl,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Book, ChevronRight, Plus, Trash2, Loader2, BookOpen, ImagePlus } from "lucide-react";
import { Link } from "wouter";

const LEVEL_OPTIONS = [
  { value: "elementary4", label: "초등 4학년" },
  { value: "elementary5", label: "초등 5학년" },
  { value: "elementary6", label: "초등 6학년" },
  { value: "middle", label: "중등" },
];

async function uploadImage(
  file: File,
  requestUploadUrlFn: (body: { filename: string; contentType: string; folder: string }) => Promise<{ uploadUrl: string; objectPath: string; publicUrl?: string }>
): Promise<string> {
  const { uploadUrl, objectPath } = await requestUploadUrlFn({
    filename: file.name,
    contentType: file.type,
    folder: "book-covers",
  });
  await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  return `/api/storage/objects/${objectPath}`;
}

export default function TeacherBooks() {
  const queryClient = useQueryClient();
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

  // Book state
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookDesc, setNewBookDesc] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chapter state
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterLevel, setNewChapterLevel] = useState("elementary4");
  const [isChapterDialogOpen, setIsChapterDialogOpen] = useState(false);

  const { data: books, isLoading: isLoadingBooks } = useListBooks();
  const { data: chapters, isLoading: isLoadingChapters } = useListChapters(selectedBookId ?? 0, {
    query: { enabled: !!selectedBookId, queryKey: getListChaptersQueryKey(selectedBookId ?? 0) },
  });

  const createBook = useCreateBook();
  const deleteBook = useDeleteBook();
  const createChapter = useCreateChapter();
  const deleteChapter = useDeleteChapter();
  const requestUploadUrl = useRequestUploadUrl();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim()) return;

    let coverImageUrl: string | undefined;
    if (coverFile) {
      setIsUploadingCover(true);
      try {
        coverImageUrl = await uploadImage(coverFile, (body) =>
          new Promise((resolve, reject) =>
            requestUploadUrl.mutate({ data: body }, { onSuccess: resolve, onError: reject })
          )
        );
      } finally {
        setIsUploadingCover(false);
      }
    }

    createBook.mutate(
      { data: { title: newBookTitle, description: newBookDesc, coverImageUrl } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
          setIsBookDialogOpen(false);
          setNewBookTitle("");
          setNewBookDesc("");
          setCoverFile(null);
          setCoverPreview(null);
        },
      }
    );
  };

  const handleDeleteBook = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("이 교재를 삭제하면 모든 챕터와 퀴즈도 함께 삭제됩니다. 계속하시겠습니까?")) {
      deleteBook.mutate({ bookId: id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
          if (selectedBookId === id) setSelectedBookId(null);
        },
      });
    }
  };

  const handleCreateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim() || !selectedBookId) return;
    createChapter.mutate(
      { bookId: selectedBookId, data: { title: newChapterTitle, level: newChapterLevel as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChaptersQueryKey(selectedBookId) });
          setIsChapterDialogOpen(false);
          setNewChapterTitle("");
          setNewChapterLevel("elementary4");
        },
      }
    );
  };

  const handleDeleteChapter = (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectedBookId) return;
    if (confirm("이 챕터를 삭제하시겠습니까?")) {
      deleteChapter.mutate({ bookId: selectedBookId, chapterId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListChaptersQueryKey(selectedBookId) }),
      });
    }
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-1">교재 관리</h1>
            <p className="text-muted-foreground">교재와 챕터를 등록하고 관리합니다.</p>
          </div>

          <Dialog open={isBookDialogOpen} onOpenChange={setIsBookDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white">
                <Plus className="w-4 h-4 mr-2" /> 교재 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 교재 추가</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateBook} className="space-y-4 mt-4">
                {/* Cover image upload */}
                <div className="space-y-2">
                  <Label>표지 이미지 (선택)</Label>
                  <div
                    className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-slate-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {coverPreview ? (
                      <img src={coverPreview} alt="미리보기" className="h-32 object-contain rounded" />
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">클릭하여 표지 이미지 업로드</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">교재명 *</Label>
                  <Input
                    id="title"
                    value={newBookTitle}
                    onChange={(e) => setNewBookTitle(e.target.value)}
                    placeholder="예) Charlotte's Web"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">설명 (선택)</Label>
                  <Input
                    id="desc"
                    value={newBookDesc}
                    onChange={(e) => setNewBookDesc(e.target.value)}
                    placeholder="책에 대한 간단한 설명"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createBook.isPending || isUploadingCover || !newBookTitle.trim()}
                >
                  {createBook.isPending || isUploadingCover ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> 저장 중...</>
                  ) : (
                    "저장"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* 교재 목록 */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-primary border-b pb-2">교재 목록</h2>
            {isLoadingBooks ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !books?.length ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                <Book className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>등록된 교재가 없습니다.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {books.map((book) => (
                  <Card
                    key={book.id}
                    className={`cursor-pointer transition-all ${
                      selectedBookId === book.id
                        ? "border-primary ring-1 ring-primary"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedBookId(book.id)}
                  >
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {book.coverImageUrl ? (
                          <img
                            src={book.coverImageUrl}
                            alt={book.title}
                            className="w-10 h-14 object-cover rounded flex-shrink-0 border"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            <BookOpen className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-primary truncate">{book.title}</p>
                          {book.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{book.description}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 flex-shrink-0"
                        onClick={(e) => handleDeleteBook(book.id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* 챕터 목록 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-xl font-bold text-primary">챕터 목록</h2>
              {selectedBookId && (
                <Dialog open={isChapterDialogOpen} onOpenChange={setIsChapterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="w-4 h-4 mr-2" /> 챕터 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>챕터 추가</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateChapter} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="chapter-title">챕터명 *</Label>
                        <Input
                          id="chapter-title"
                          value={newChapterTitle}
                          onChange={(e) => setNewChapterTitle(e.target.value)}
                          placeholder="예) Chapter 1"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>학습 레벨</Label>
                        <Select value={newChapterLevel} onValueChange={setNewChapterLevel}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEVEL_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createChapter.isPending || !newChapterTitle.trim()}
                      >
                        {createChapter.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {!selectedBookId ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed bg-slate-50/50">
                왼쪽에서 교재를 선택하면 챕터를 확인할 수 있습니다.
              </Card>
            ) : isLoadingChapters ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !chapters?.length ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                아직 등록된 챕터가 없습니다.
              </Card>
            ) : (
              <div className="space-y-2">
                {chapters.map((chapter) => {
                  const levelLabel = LEVEL_OPTIONS.find((o) => o.value === chapter.level)?.label;
                  return (
                    <Card key={chapter.id} className="hover:border-primary/50 transition-colors group overflow-hidden">
                      <div className="flex items-center">
                        <div className="flex-1 p-4">
                          <p className="font-bold text-primary">{chapter.title}</p>
                          {levelLabel && (
                            <span className="text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">
                              {levelLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 pr-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleDeleteChapter(chapter.id, e)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Link
                            href={`/teacher/content/${chapter.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          >
                            내용 편집 <ChevronRight className="w-4 h-4 ml-1" />
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
