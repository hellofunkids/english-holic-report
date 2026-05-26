import { useState } from "react";
import { useRoute, Link } from "wouter";
import { TeacherLayout } from "@/components/layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  useListVocabulary, 
  useCreateVocabItem, 
  useDeleteVocabItem,
  useListQuizzes,
  useCreateQuizQuestion,
  useDeleteQuizQuestion,
  getListVocabularyQueryKey,
  getListQuizzesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft, Loader2, BookA, HelpCircle } from "lucide-react";

export default function TeacherContent() {
  const [, params] = useRoute("/teacher/content/:chapterId");
  const chapterId = params?.chapterId ? parseInt(params.chapterId) : 0;
  const queryClient = useQueryClient();

  const { data: vocabList, isLoading: isLoadingVocab } = useListVocabulary(chapterId, { query: { enabled: !!chapterId } });
  const { data: quizzes, isLoading: isLoadingQuizzes } = useListQuizzes(chapterId, { query: { enabled: !!chapterId } });

  const createVocab = useCreateVocabItem();
  const deleteVocab = useDeleteVocabItem();
  const createQuiz = useCreateQuizQuestion();
  const deleteQuiz = useDeleteQuizQuestion();

  // Vocab State
  const [isVocabDialogOpen, setIsVocabDialogOpen] = useState(false);
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [exampleSentence, setExampleSentence] = useState("");

  // Quiz State
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [questionType, setQuestionType] = useState<"multiple_choice" | "short_answer">("multiple_choice");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);

  const handleCreateVocab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;

    createVocab.mutate({
      chapterId,
      data: { word, meaning, exampleSentence }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListVocabularyQueryKey(chapterId) });
        setIsVocabDialogOpen(false);
        setWord("");
        setMeaning("");
        setExampleSentence("");
      }
    });
  };

  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;

    createQuiz.mutate({
      chapterId,
      data: { 
        questionType, 
        question, 
        answer, 
        explanation,
        options: questionType === "multiple_choice" ? options.filter(o => o.trim() !== "") : undefined
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey(chapterId) });
        setIsQuizDialogOpen(false);
        setQuestion("");
        setAnswer("");
        setExplanation("");
        setOptions(["", "", "", ""]);
      }
    });
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/teacher/books" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-primary">Content Editor</h1>
            <p className="text-muted-foreground">Manage vocabulary and comprehension questions.</p>
          </div>
        </div>

        <Tabs defaultValue="vocab" className="w-full">
          <TabsList className="w-full max-w-md grid grid-cols-2 mb-8">
            <TabsTrigger value="vocab"><BookA className="w-4 h-4 mr-2" /> Vocabulary</TabsTrigger>
            <TabsTrigger value="quiz"><HelpCircle className="w-4 h-4 mr-2" /> Comprehension</TabsTrigger>
          </TabsList>

          <TabsContent value="vocab" className="space-y-4 mt-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-primary">Vocabulary List</h2>
              <Dialog open={isVocabDialogOpen} onOpenChange={setIsVocabDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" /> Add Word</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Vocabulary Item</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateVocab} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="word">English Word</Label>
                      <Input id="word" value={word} onChange={e => setWord(e.target.value)} autoFocus />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meaning">Korean Meaning</Label>
                      <Input id="meaning" value={meaning} onChange={e => setMeaning(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="example">Example Sentence (Optional)</Label>
                      <Textarea 
                        id="example" 
                        value={exampleSentence} 
                        onChange={e => setExampleSentence(e.target.value)} 
                        placeholder={`Include the word here, e.g., "The cat is sleeping."`}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={createVocab.isPending || !word.trim() || !meaning.trim()}>
                      {createVocab.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingVocab ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !vocabList?.length ? (
              <Card className="p-12 text-center text-muted-foreground border-dashed">
                No vocabulary items yet. Add some words to automatically generate vocab quizzes.
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vocabList.map(item => (
                  <Card key={item.id} className="relative group">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if(confirm("Delete this word?")) {
                          deleteVocab.mutate({ chapterId, vocabId: item.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListVocabularyQueryKey(chapterId) })
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <CardContent className="p-5 pt-6">
                      <p className="text-xl font-bold text-primary mb-1">{item.word}</p>
                      <p className="text-lg font-medium text-accent mb-3">{item.meaning}</p>
                      {item.exampleSentence && (
                        <p className="text-sm text-muted-foreground italic border-t pt-2 mt-2">{item.exampleSentence}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="quiz" className="space-y-4 mt-0">
             <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-primary">Comprehension Questions</h2>
              <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" /> Add Question</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Comprehension Question</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateQuiz} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Question Type</Label>
                      <Select value={questionType} onValueChange={(val: any) => setQuestionType(val)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                          <SelectItem value="short_answer">Short Answer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="question">Question</Label>
                      <Textarea id="question" value={question} onChange={e => setQuestion(e.target.value)} />
                    </div>

                    {questionType === "multiple_choice" && (
                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                        <Label>Options</Label>
                        {options.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-6 text-center text-sm font-bold text-muted-foreground">{idx + 1}.</span>
                            <Input value={opt} onChange={e => {
                              const newOpts = [...options];
                              newOpts[idx] = e.target.value;
                              setOptions(newOpts);
                            }} />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="answer">Correct Answer {questionType === "multiple_choice" && "(Must match one of the options exactly)"}</Label>
                      <Input id="answer" value={answer} onChange={e => setAnswer(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="explanation">Explanation (Optional)</Label>
                      <Textarea id="explanation" value={explanation} onChange={e => setExplanation(e.target.value)} />
                    </div>

                    <Button type="submit" className="w-full" disabled={createQuiz.isPending || !question.trim() || !answer.trim()}>
                      {createQuiz.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingQuizzes ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !quizzes?.length ? (
              <Card className="p-12 text-center text-muted-foreground border-dashed">
                No comprehension questions yet. Add questions to test reading understanding.
              </Card>
            ) : (
              <div className="space-y-4">
                {quizzes.map((quiz, index) => (
                  <Card key={quiz.id} className="relative group p-6">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if(confirm("Delete this question?")) {
                          deleteQuiz.mutate({ chapterId, quizId: quiz.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey(chapterId) })
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="pr-10">
                      <span className="inline-block px-2 py-1 bg-secondary text-secondary-foreground text-xs font-bold rounded mb-3">
                        {quiz.questionType === "multiple_choice" ? "Multiple Choice" : "Short Answer"}
                      </span>
                      <p className="text-lg font-bold text-primary mb-4">{index + 1}. {quiz.question}</p>
                      
                      {quiz.options && quiz.options.length > 0 && (
                        <ul className="space-y-1 mb-4 ml-4 list-disc text-muted-foreground">
                          {quiz.options.map((opt, i) => (
                            <li key={i} className={opt === quiz.answer ? "text-green-600 font-bold" : ""}>{opt}</li>
                          ))}
                        </ul>
                      )}
                      
                      <div className="bg-green-50 text-green-800 p-3 rounded-md border border-green-200 mt-4">
                        <span className="font-bold text-xs uppercase block mb-1">Answer</span>
                        {quiz.answer}
                      </div>

                      {quiz.explanation && (
                        <div className="bg-slate-50 text-slate-700 p-3 rounded-md border mt-2 text-sm">
                          <span className="font-bold text-xs uppercase block mb-1">Explanation</span>
                          {quiz.explanation}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TeacherLayout>
  );
}
