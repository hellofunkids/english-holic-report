import { useState } from "react";
import { useLocation } from "wouter";
import { StudentLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuizContext } from "@/lib/quiz-store";
import { useListBooks, useListChapters } from "@workspace/api-client-react";
import { Book, ChevronRight, Loader2 } from "lucide-react";

export default function StudentSelect() {
  const [, setLocation] = useLocation();
  const { state, setBookAndChapter } = useQuizContext();
  const [selectedBookId, setSelectedBookId] = useState<number | null>(state.bookId);

  const { data: books, isLoading: isLoadingBooks } = useListBooks();
  const { data: chapters, isLoading: isLoadingChapters } = useListChapters(selectedBookId ?? 0, {
    query: { enabled: !!selectedBookId }
  });

  const handleStartQuiz = (chapterId: number) => {
    if (selectedBookId) {
      setBookAndChapter(selectedBookId, chapterId);
      setLocation("/student/quiz");
    }
  };

  if (!state.studentName) {
    setLocation("/student");
    return null;
  }

  return (
    <StudentLayout>
      <div className="py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-2">1. 책 선택</h1>
          <p className="text-muted-foreground">학습할 책을 선택해주세요.</p>
        </div>

        {isLoadingBooks ? (
          <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : !books?.length ? (
          <Card className="p-8 text-center border-dashed">
            <Book className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">등록된 책이 없습니다.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {books.map(book => (
              <Card 
                key={book.id}
                className={`p-6 cursor-pointer transition-all border-2 ${selectedBookId === book.id ? 'border-accent bg-accent/5' : 'hover:border-primary/30'}`}
                onClick={() => setSelectedBookId(book.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-primary">{book.title}</h3>
                    {book.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{book.description}</p>}
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedBookId === book.id ? 'border-accent bg-accent' : 'border-muted-foreground/30'}`}>
                    {selectedBookId === book.id && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {selectedBookId && (
          <div className="pt-8 border-t">
            <h2 className="text-2xl font-bold text-primary mb-2">2. 챕터 선택</h2>
            <p className="text-muted-foreground mb-6">퀴즈를 풀 챕터를 선택해주세요.</p>

            {isLoadingChapters ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
            ) : !chapters?.length ? (
              <Card className="p-8 text-center border-dashed">
                <p className="text-muted-foreground">이 책에는 아직 챕터가 없습니다.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {chapters.map(chapter => (
                  <Button
                    key={chapter.id}
                    variant="outline"
                    className="w-full h-16 justify-between text-left px-6 text-lg font-medium border-2 hover:border-accent hover:bg-accent/5 hover:text-primary group"
                    onClick={() => handleStartQuiz(chapter.id)}
                  >
                    <span>{chapter.title}</span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
