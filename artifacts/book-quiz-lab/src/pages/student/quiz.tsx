import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { StudentLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useQuizContext } from "@/lib/quiz-store";
import { 
  useListVocabulary, 
  useListQuizzes, 
  useCreateSubmission,
  getListVocabularyQueryKey,
  getListQuizzesQueryKey,
  VocabItem,
  QuizQuestion,
  AnswerInput
} from "@workspace/api-client-react";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Helper to shuffle array
function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

type GeneratedVocabQuestion = {
  id: number;
  vocabId: number;
  type: 'vocab_en_to_ko' | 'vocab_ko_to_en' | 'vocab_multiple_choice' | 'vocab_fill_blank';
  question: string;
  options?: string[];
  answer: string;
  original: VocabItem;
};

export default function StudentQuiz() {
  const [, setLocation] = useLocation();
  const { state, setSubmissionResult } = useQuizContext();
  const { bookId, chapterId, studentName } = state;

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerInput[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");

  const { data: vocabList, isLoading: isLoadingVocab } = useListVocabulary(chapterId ?? 0, {
    query: { enabled: !!chapterId, queryKey: getListVocabularyQueryKey(chapterId ?? 0) }
  });
  
  const { data: quizzes, isLoading: isLoadingQuizzes } = useListQuizzes(chapterId ?? 0, {
    query: { enabled: !!chapterId, queryKey: getListQuizzesQueryKey(chapterId ?? 0) }
  });

  const createSubmission = useCreateSubmission();

  const vocabQuestions = useMemo(() => {
    if (!vocabList || vocabList.length === 0) return [];
    
    // Generate 1 question per vocab item
    const questions: GeneratedVocabQuestion[] = vocabList.map((vocab, index) => {
      // Determine question type randomly or based on available data
      const types = ['vocab_en_to_ko', 'vocab_ko_to_en', 'vocab_multiple_choice'];
      if (vocab.exampleSentence && vocab.exampleSentence.includes(vocab.word)) {
        types.push('vocab_fill_blank');
      }
      
      const type = types[Math.floor(Math.random() * types.length)] as any;
      
      let question = "";
      let answer = "";
      let options: string[] | undefined;

      switch (type) {
        case 'vocab_en_to_ko':
          question = vocab.word;
          answer = vocab.meaning;
          break;
        case 'vocab_ko_to_en':
          question = vocab.meaning;
          answer = vocab.word;
          break;
        case 'vocab_multiple_choice':
          question = `다음 단어의 뜻으로 알맞은 것은?\n${vocab.word}`;
          answer = vocab.meaning;
          // Pick 3 random meanings from other words
          const distractors = shuffle(vocabList.filter(v => v.id !== vocab.id)).slice(0, 3).map(v => v.meaning);
          options = shuffle([answer, ...distractors]);
          break;
        case 'vocab_fill_blank':
          question = vocab.exampleSentence!.replace(new RegExp(vocab.word, 'gi'), '_____');
          answer = vocab.word;
          break;
      }

      return {
        id: index,
        vocabId: vocab.id,
        type,
        question,
        options,
        answer,
        original: vocab
      };
    });
    
    return shuffle(questions);
  }, [vocabList]);

  const allQuestions = useMemo(() => {
    const vq = vocabQuestions.map(q => ({
      ...q,
      isVocab: true
    }));
    
    const cq = (quizzes || []).map(q => ({
      ...q,
      isVocab: false
    }));
    
    return [...vq, ...cq];
  }, [vocabQuestions, quizzes]);

  if (!studentName || !bookId || !chapterId) {
    setLocation("/student");
    return null;
  }

  const handleNext = () => {
    const currentQ = allQuestions[currentStep];
    
    const newAnswer: AnswerInput = {
      questionId: currentQ.isVocab ? (currentQ as GeneratedVocabQuestion).vocabId : currentQ.id,
      questionType: currentQ.isVocab ? (currentQ as GeneratedVocabQuestion).type : (currentQ as QuizQuestion).questionType === 'multiple_choice' ? 'comprehension_multiple_choice' : 'comprehension_short_answer',
      answer: currentAnswer.trim()
    };
    
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    setCurrentAnswer("");

    if (currentStep < allQuestions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = (finalAnswers: AnswerInput[]) => {
    createSubmission.mutate({
      data: {
        studentName,
        chapterId,
        answers: finalAnswers
      }
    }, {
      onSuccess: (result) => {
        setSubmissionResult(result);
        setLocation("/student/result");
      }
    });
  };

  if (isLoadingVocab || isLoadingQuizzes) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-12 h-12 animate-spin text-accent mb-4" />
          <p className="text-primary font-bold text-lg">퀴즈를 준비하고 있습니다...</p>
        </div>
      </StudentLayout>
    );
  }

  if (allQuestions.length === 0) {
    return (
      <StudentLayout>
        <Card className="p-8 text-center max-w-md mx-auto mt-12">
          <p className="text-muted-foreground mb-6">이 챕터에는 아직 등록된 퀴즈가 없습니다.</p>
          <Button onClick={() => setLocation("/student/select")} className="w-full">
            다른 챕터 선택하기
          </Button>
        </Card>
      </StudentLayout>
    );
  }

  const currentQ = allQuestions[currentStep];
  const progress = ((currentStep) / allQuestions.length) * 100;
  const isLast = currentStep === allQuestions.length - 1;

  return (
    <StudentLayout>
      <div className="max-w-2xl mx-auto py-8">
        <div className="mb-8">
          <div className="flex justify-between text-sm font-medium text-muted-foreground mb-2">
            <span>진행률</span>
            <span>{currentStep + 1} / {allQuestions.length}</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-6 md:p-10 border-2 shadow-md mb-8">
              <div className="mb-8">
                <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold mb-4">
                  {currentQ.isVocab ? "어휘 퀴즈" : "이해력 퀴즈"}
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-primary whitespace-pre-wrap">
                  {currentQ.question}
                </h2>
              </div>

              <div className="space-y-4">
                {currentQ.options && currentQ.options.length > 0 ? (
                  <div className="space-y-3">
                    {currentQ.options.map((option: string, idx: number) => (
                      <button
                        key={idx}
                        className={`w-full text-left p-5 rounded-xl border-2 transition-all text-lg font-medium
                          ${currentAnswer === option 
                            ? 'border-accent bg-accent/10 text-primary' 
                            : 'border-muted hover:border-primary/30'}`}
                        onClick={() => setCurrentAnswer(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <Input
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      placeholder="정답을 입력하세요"
                      className="h-16 text-xl px-6 border-2 focus-visible:ring-accent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && currentAnswer.trim()) {
                          handleNext();
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </Card>

            <Button
              className="w-full h-16 text-xl font-bold rounded-xl"
              size="lg"
              disabled={!currentAnswer.trim() || createSubmission.isPending}
              onClick={handleNext}
            >
              {createSubmission.isPending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : isLast ? (
                <>제출하기 <CheckCircle2 className="ml-2 w-6 h-6" /></>
              ) : (
                <>다음 <ArrowRight className="ml-2 w-6 h-6" /></>
              )}
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </StudentLayout>
  );
}
