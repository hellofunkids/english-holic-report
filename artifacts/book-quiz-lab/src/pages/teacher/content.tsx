import { useState } from "react";
import { useRoute, Link } from "wouter";
import { TeacherLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
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
  useGeneratePdf,
  getListVocabularyQueryKey,
  getListQuizzesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft, Loader2, BookA, HelpCircle, FileDown, CheckCircle2 } from "lucide-react";

const LEVEL_OPTIONS = [
  { value: "elementary4", label: "초등 4학년" },
  { value: "elementary5", label: "초등 5학년" },
  { value: "elementary6", label: "초등 6학년" },
  { value: "middle", label: "중등" },
];

function downloadBase64Pdf(base64: string, filename: string) {
  const link = document.createElement("a");
  link.href = `data:application/pdf;base64,${base64}`;
  link.download = filename;
  link.click();
}

export default function TeacherContent() {
  const [, params] = useRoute("/teacher/content/:chapterId");
  const chapterId = params?.chapterId ? parseInt(params.chapterId) : 0;
  const queryClient = useQueryClient();

  const { data: vocabList, isLoading: isLoadingVocab } = useListVocabulary(chapterId, { query: { enabled: !!chapterId, queryKey: getListVocabularyQueryKey(chapterId) } });
  const { data: quizzes, isLoading: isLoadingQuizzes } = useListQuizzes(chapterId, { query: { enabled: !!chapterId, queryKey: getListQuizzesQueryKey(chapterId) } });

  const createVocab = useCreateVocabItem();
  const deleteVocab = useDeleteVocabItem();
  const createQuiz = useCreateQuizQuestion();
  const deleteQuiz = useDeleteQuizQuestion();
  const generatePdf = useGeneratePdf();

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

  // PDF State
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false);
  const [pdfLevel, setPdfLevel] = useState("elementary4");
  const [pdfResult, setPdfResult] = useState<{ quizPdfBase64: string; answerPdfBase64: string } | null>(null);

  const handleCreateVocab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) return;
    createVocab.mutate(
      { chapterId, data: { word, meaning, exampleSentence } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVocabularyQueryKey(chapterId) });
          setIsVocabDialogOpen(false);
          setWord("");
          setMeaning("");
          setExampleSentence("");
        },
      }
    );
  };

  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    createQuiz.mutate(
      {
        chapterId,
        data: {
          questionType,
          question,
          answer,
          explanation,
          options: questionType === "multiple_choice" ? options.filter((o) => o.trim() !== "") : undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey(chapterId) });
          setIsQuizDialogOpen(false);
          setQuestion("");
          setAnswer("");
          setExplanation("");
          setOptions(["", "", "", ""]);
        },
      }
    );
  };

  const handleGeneratePdf = () => {
    setPdfResult(null);
    generatePdf.mutate(
      { chapterId, data: { level: pdfLevel as any } },
      {
        onSuccess: (data) => {
          setPdfResult({ quizPdfBase64: data.quizPdfBase64, answerPdfBase64: data.answerPdfBase64 });
        },
      }
    );
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/teacher/books" className="text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-primary">내용 편집</h1>
              <p className="text-muted-foreground">어휘와 이해 문제를 관리합니다.</p>
            </div>
          </div>

          {/* AI PDF 생성 버튼 */}
          <Dialog open={isPdfDialogOpen} onOpenChange={(open) => { setIsPdfDialogOpen(open); if (!open) setPdfResult(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-accent text-accent hover:bg-accent/10 gap-2">
                <FileDown className="w-4 h-4" /> AI 시험지 생성
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-primary">AI 독해 시험지 생성</DialogTitle>
              </DialogHeader>

              {!pdfResult ? (
                <div className="space-y-5 mt-2">
                  <p className="text-sm text-muted-foreground">
                    AI가 이 챕터의 교재 내용을 바탕으로 20문항 객관식 시험지(퀴즈지 + 정답지)를 자동 생성합니다.
                    약 20-30초 정도 소요됩니다.
                  </p>
                  <div className="space-y-2">
                    <Label>학습 레벨</Label>
                    <Select value={pdfLevel} onValueChange={setPdfLevel}>
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
                    className="w-full"
                    onClick={handleGeneratePdf}
                    disabled={generatePdf.isPending}
                  >
                    {generatePdf.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> AI 생성 중... (20-30초)</>
                    ) : (
                      <><FileDown className="w-4 h-4 mr-2" /> 시험지 생성</>
                    )}
                  </Button>
                  {generatePdf.isError && (
                    <p className="text-sm text-destructive text-center">생성 중 오류가 발생했습니다. 다시 시도해 주세요.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-5 mt-2">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-green-800">시험지 생성 완료</p>
                      <p className="text-sm text-green-700">20문항 시험지가 준비되었습니다.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => downloadBase64Pdf(pdfResult.quizPdfBase64, "quiz.pdf")}
                      className="w-full"
                    >
                      <FileDown className="w-4 h-4 mr-2" /> 퀴즈지 다운로드
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => downloadBase64Pdf(pdfResult.answerPdfBase64, "answer-key.pdf")}
                      className="w-full"
                    >
                      <FileDown className="w-4 h-4 mr-2" /> 정답지 다운로드
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => { setPdfResult(null); generatePdf.reset(); }}
                  >
                    다시 생성
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="vocab" className="w-full">
          <TabsList className="w-full max-w-md grid grid-cols-2 mb-8">
            <TabsTrigger value="vocab"><BookA className="w-4 h-4 mr-2" /> 어휘 목록</TabsTrigger>
            <TabsTrigger value="quiz"><HelpCircle className="w-4 h-4 mr-2" /> 이해 문제</TabsTrigger>
          </TabsList>

          {/* ── 어휘 탭 ─────────────────────────────────────────────────────────── */}
          <TabsContent value="vocab" className="space-y-4 mt-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-primary">어휘 목록</h2>
              <Dialog open={isVocabDialogOpen} onOpenChange={setIsVocabDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" /> 단어 추가</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>어휘 항목 추가</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateVocab} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="word">영어 단어</Label>
                      <Input id="word" value={word} onChange={(e) => setWord(e.target.value)} autoFocus />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meaning">한국어 뜻</Label>
                      <Input id="meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="example">예문 (선택)</Label>
                      <Textarea
                        id="example"
                        value={exampleSentence}
                        onChange={(e) => setExampleSentence(e.target.value)}
                        placeholder='예) "The spider spun a beautiful web."'
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createVocab.isPending || !word.trim() || !meaning.trim()}
                    >
                      {createVocab.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingVocab ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !vocabList?.length ? (
              <Card className="p-12 text-center text-muted-foreground border-dashed">
                아직 등록된 단어가 없습니다. 단어를 추가하면 어휘 퀴즈가 자동 생성됩니다.
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vocabList.map((item) => (
                  <Card key={item.id} className="relative group">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("이 단어를 삭제하시겠습니까?")) {
                          deleteVocab.mutate({ vocabId: item.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListVocabularyQueryKey(chapterId) }),
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

          {/* ── 이해 문제 탭 ──────────────────────────────────────────────────────── */}
          <TabsContent value="quiz" className="space-y-4 mt-0">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-primary">이해 문제</h2>
              <Dialog open={isQuizDialogOpen} onOpenChange={setIsQuizDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" /> 문제 추가</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>이해 문제 추가</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateQuiz} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>문제 유형</Label>
                      <Select value={questionType} onValueChange={(val: any) => setQuestionType(val)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_choice">객관식</SelectItem>
                          <SelectItem value="short_answer">단답형</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="question">문제</Label>
                      <Textarea id="question" value={question} onChange={(e) => setQuestion(e.target.value)} />
                    </div>
                    {questionType === "multiple_choice" && (
                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                        <Label>보기</Label>
                        {options.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-6 text-center text-sm font-bold text-muted-foreground">{idx + 1}.</span>
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...options];
                                newOpts[idx] = e.target.value;
                                setOptions(newOpts);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="answer">
                        정답 {questionType === "multiple_choice" && "(보기 내용과 정확히 일치해야 합니다)"}
                      </Label>
                      <Input id="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="explanation">해설 (선택)</Label>
                      <Textarea id="explanation" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createQuiz.isPending || !question.trim() || !answer.trim()}
                    >
                      {createQuiz.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {isLoadingQuizzes ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !quizzes?.length ? (
              <Card className="p-12 text-center text-muted-foreground border-dashed">
                아직 등록된 문제가 없습니다.
              </Card>
            ) : (
              <div className="space-y-4">
                {quizzes.map((quiz, index) => (
                  <Card key={quiz.id} className="relative group p-6">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("이 문제를 삭제하시겠습니까?")) {
                          deleteQuiz.mutate({ quizId: quiz.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey(chapterId) }),
                          });
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <div className="pr-10">
                      <span className="inline-block px-2 py-1 bg-secondary text-secondary-foreground text-xs font-bold rounded mb-3">
                        {quiz.questionType === "multiple_choice" ? "객관식" : "단답형"}
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
                        <span className="font-bold text-xs uppercase block mb-1">정답</span>
                        {quiz.answer}
                      </div>
                      {quiz.explanation && (
                        <div className="bg-slate-50 text-slate-700 p-3 rounded-md border mt-2 text-sm">
                          <span className="font-bold text-xs uppercase block mb-1">해설</span>
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
