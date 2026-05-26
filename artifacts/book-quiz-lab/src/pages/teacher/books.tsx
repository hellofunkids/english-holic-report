import { useState } from "react";
import { TeacherLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  useListBooks, 
  useCreateBook,
  useDeleteBook,
  useListChapters,
  useCreateChapter,
  useDeleteChapter,
  getListBooksQueryKey,
  getListChaptersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Book, ChevronRight, Plus, Trash2, Loader2, BookOpen } from "lucide-react";
import { Link } from "wouter";

export default function TeacherBooks() {
  const queryClient = useQueryClient();
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  
  // Book state
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookDesc, setNewBookDesc] = useState("");
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false);

  // Chapter state
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [isChapterDialogOpen, setIsChapterDialogOpen] = useState(false);

  const { data: books, isLoading: isLoadingBooks } = useListBooks();
  const { data: chapters, isLoading: isLoadingChapters } = useListChapters(selectedBookId ?? 0, {
    query: { enabled: !!selectedBookId }
  });

  const createBook = useCreateBook();
  const deleteBook = useDeleteBook();
  const createChapter = useCreateChapter();
  const deleteChapter = useDeleteChapter();

  const handleCreateBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim()) return;
    
    createBook.mutate({
      data: { title: newBookTitle, description: newBookDesc }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
        setIsBookDialogOpen(false);
        setNewBookTitle("");
        setNewBookDesc("");
      }
    });
  };

  const handleDeleteBook = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this book? All chapters and quizzes will be deleted.")) {
      deleteBook.mutate({ bookId: id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
          if (selectedBookId === id) setSelectedBookId(null);
        }
      });
    }
  };

  const handleCreateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim() || !selectedBookId) return;
    
    createChapter.mutate({
      bookId: selectedBookId,
      data: { title: newChapterTitle }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChaptersQueryKey(selectedBookId) });
        setIsChapterDialogOpen(false);
        setNewChapterTitle("");
      }
    });
  };

  const handleDeleteChapter = (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectedBookId) return;

    if (confirm("Are you sure you want to delete this chapter?")) {
      deleteChapter.mutate({ bookId: selectedBookId, chapterId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChaptersQueryKey(selectedBookId) });
        }
      });
    }
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Manage Books</h1>
            <p className="text-muted-foreground">Add and organize reading materials and chapters.</p>
          </div>
          
          <Dialog open={isBookDialogOpen} onOpenChange={setIsBookDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white"><Plus className="w-4 h-4 mr-2" /> Add Book</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Book</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateBook} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Book Title</Label>
                  <Input 
                    id="title" 
                    value={newBookTitle} 
                    onChange={e => setNewBookTitle(e.target.value)} 
                    placeholder="e.g. Harry Potter and the Sorcerer's Stone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description (Optional)</Label>
                  <Input 
                    id="desc" 
                    value={newBookDesc} 
                    onChange={e => setNewBookDesc(e.target.value)} 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createBook.isPending || !newBookTitle.trim()}>
                  {createBook.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Book"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Books List */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-primary border-b pb-2">Books</h2>
            
            {isLoadingBooks ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !books?.length ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                <Book className="w-12 h-12 mx-auto mb-4 opacity-20" />
                No books added yet.
              </Card>
            ) : (
              <div className="space-y-2">
                {books.map(book => (
                  <Card 
                    key={book.id}
                    className={`cursor-pointer transition-colors ${selectedBookId === book.id ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'}`}
                    onClick={() => setSelectedBookId(book.id)}
                  >
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-primary">{book.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{book.description}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={(e) => handleDeleteBook(book.id, e)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Chapters List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-xl font-bold text-primary">Chapters</h2>
              {selectedBookId && (
                <Dialog open={isChapterDialogOpen} onOpenChange={setIsChapterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-2" /> Add Chapter</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Chapter</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateChapter} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="chapter-title">Chapter Title</Label>
                        <Input 
                          id="chapter-title" 
                          value={newChapterTitle} 
                          onChange={e => setNewChapterTitle(e.target.value)} 
                          placeholder="e.g. Chapter 1: The Boy Who Lived"
                          autoFocus
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={createChapter.isPending || !newChapterTitle.trim()}>
                        {createChapter.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Chapter"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {!selectedBookId ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed bg-slate-50/50">
                Select a book to view and manage its chapters.
              </Card>
            ) : isLoadingChapters ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !chapters?.length ? (
              <Card className="p-8 text-center text-muted-foreground border-dashed">
                No chapters added yet.
              </Card>
            ) : (
              <div className="space-y-2">
                {chapters.map(chapter => (
                  <Card key={chapter.id} className="hover:border-primary/50 transition-colors group overflow-hidden">
                    <div className="flex items-center">
                      <div className="flex-1 p-4">
                        <p className="font-bold text-primary">{chapter.title}</p>
                      </div>
                      <div className="flex items-center gap-1 pr-2">
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDeleteChapter(chapter.id, e)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Link href={`/teacher/content/${chapter.id}`} className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80">
                          Edit Content <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
